import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../supabase/migrations/', import.meta.url);
const sql = name => readFileSync(new URL(readdirSync(root).find(f=>f.endsWith(name+'.sql')), root),'utf8');
const db=new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema storage;
create table storage.objects(name text, owner_id text, bucket_id text);
create table public.restaurants(user_id uuid, photo_url text, image_url text, photo_urls text[]);
create table public.profiles(id uuid, avatar_url text, nickname text);
create table public.wishes(user_id uuid,capture_path text);
create table public.board_posts(author_id uuid,title text,body text,note text,tags text[]);
create table public.gallery_photos(author_id uuid,photo_ref text,caption text,menu text);
create table public.board_comments(body text);
create table public.gallery_comments(body text);
create table public.friend_posts(note text);
create table public.record_comments(body text);
`);
// Replay before the later board-photo migration as well as after it.
await db.exec(sql('beta_account_cleanup'));
await db.exec(`alter table board_posts add column photo_refs text[];`);
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222';
await db.query(`insert into storage.objects values
 ('wish.jpg',null,'restaurant-photos'),('board.jpg',null,'restaurant-photos'),
 ('gallery.jpg',null,'restaurant-photos'),('shared.jpg',$1,'restaurant-photos'),
 ('orphan.jpg',$1,'restaurant-photos'),('other.jpg',$2,'restaurant-photos')`,[A,B]);
await db.query(`insert into wishes values ($1,'wish.jpg')`,[A]);
await db.query(`insert into board_posts(author_id,photo_refs) values ($1,array['board.jpg'])`,[A]);
await db.query(`insert into gallery_photos(author_id,photo_ref) values ($1,'gallery.jpg')`,[A]);
await db.query(`insert into restaurants values ($1,'shared.jpg',null,null)`,[B]);
const paths=await db.query(`select public.account_photo_paths($1) as path`,[A]);
assert.deepEqual(paths.rows.map(r=>r.path).sort(),['board.jpg','gallery.jpg','orphan.jpg','wish.jpg']);
const grants=await db.query(`select has_function_privilege('authenticated','public.account_photo_paths(uuid)','execute') as client, has_function_privilege('service_role','public.account_photo_paths(uuid)','execute') as server`);
assert.deepEqual(grants.rows[0],{client:false,server:true});
await db.exec(sql('beta_content_filter'));
await db.exec(`insert into board_posts(title,body) values ('맛있는 저녁','shiitake mushrooms and sushi');`);
for(const query of [
 `insert into board_comments values ('씨 발')`,
 `insert into gallery_comments values ('FUCK')`,
 `insert into friend_posts values ('개새끼')`,
 `insert into record_comments values ('병신')`,
 `insert into profiles(nickname) values ('씨빨')`,
 `insert into gallery_photos(caption) values ('아동포르노')`,
 `update board_posts set body='motherfucker'`,
]) await assert.rejects(db.exec(query), /게시할 수 없는/);
await db.exec(`set role authenticated;`);
const allowed=await db.query(`select public.contains_objectionable_text('정말 맛있어요') as blocked`);
assert.equal(allowed.rows[0].blocked,false);
await db.close();
console.log('PASS: migration order, ownerless attachments, shared-photo preservation, execute grants, seven direct-write filtering paths and normal text.');
