import {postContext,checkOrigin,failure,json,ApiError} from '@/app/api/collaboration-utils';
import {authorName} from '@/db/studio';
import {z} from 'zod';
export const dynamic='force-dynamic';
type RouteContext={params:Promise<{postId:string}>};
type AssetRow={id:string;postId:string;kind:string;name:string;contentType:string;size:number;authorId:string;authorName:string;createdAt:number};
type CommentRow={id:string;postId:string;text:string;authorId:string;authorName:string;createdAt:number;replyTo:string|null};
export async function GET(_req:Request,route:RouteContext){try{const{postId}=await route.params;const{db,user,owner}=await postContext(postId);const[assets,comments]=await Promise.all([
 db.prepare('SELECT id,post_id AS postId,kind,name,content_type AS contentType,size,author_id AS authorId,author_name AS authorName,created_at AS createdAt FROM post_assets WHERE post_id=? AND owner=? ORDER BY created_at DESC,id DESC').bind(postId,owner).all<AssetRow>(),
 db.prepare('SELECT id,post_id AS postId,text,author_id AS authorId,author_name AS authorName,created_at AS createdAt,reply_to AS replyTo FROM post_comments WHERE post_id=? AND owner=? ORDER BY created_at ASC,id ASC').bind(postId,owner).all<CommentRow>()
 ]);return json({assets:assets.results.map(({authorId,...a})=>({...a,url:'/api/attachments/'+a.id,canDelete:user.userId===owner||user.userId===authorId})),comments:comments.results.map(({authorId,...c})=>({...c,canDelete:user.userId===owner||user.userId===authorId}))});}catch(error){return failure(error,'Görseller ve yorumlar yüklenemedi.');}}
const commentSchema=z.object({text:z.string().trim().min(1,'Yorumunu yaz.').max(3000,'Yorum en fazla 3000 karakter olabilir.'),replyTo:z.string().min(1).max(200).nullable().optional()});
export async function POST(req:Request,route:RouteContext){try{checkOrigin(req);const{postId}=await route.params;const{db,user,owner}=await postContext(postId);let body:unknown;try{body=await req.json();}catch{throw new ApiError('Yorumunu kontrol et.',400);}const parsed=commentSchema.safeParse(body);if(!parsed.success)throw new ApiError(parsed.error.issues[0]?.message||'Yorumunu kontrol et.',400);const{text,replyTo}=parsed.data;if(replyTo){const parent=await db.prepare('SELECT id FROM post_comments WHERE id=? AND post_id=? AND owner=?').bind(replyTo,postId,owner).first();if(!parent)throw new ApiError('Yanıtladığın yorum bulunamadı. Yeni bir yorum olarak gönderebilirsin.',400);}
 const comment={id:crypto.randomUUID(),postId,text,authorName:authorName(user,owner),createdAt:Date.now(),replyTo:replyTo||null};await db.prepare('INSERT INTO post_comments (id,post_id,owner,text,author_id,author_name,created_at,reply_to) VALUES (?,?,?,?,?,?,?,?)').bind(comment.id,postId,owner,text,user.userId,comment.authorName,comment.createdAt,comment.replyTo).run();return json({comment:{...comment,canDelete:true}},201);
 }catch(error){return failure(error,'Yorum gönderilemedi.');}}
