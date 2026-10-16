export type AssetKind='reference'|'design';
export type PostAsset={id:string;postId:string;kind:AssetKind;name:string;contentType:string;size:number;authorName:string;createdAt:number;url:string;canDelete:boolean};
export type PostComment={id:string;postId:string;text:string;authorName:string;createdAt:number;replyTo:string|null;canDelete:boolean};
export type CollaborationData={assets:PostAsset[];comments:PostComment[]};
