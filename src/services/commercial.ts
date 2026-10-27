export type Option={name:string;values:string[]};
export type Category={id:string;name:string;prefix:string;options:Option[];revision:number};
export type Campaign={id:string;name:string;ordersUrl?:string|null;collectionUrl?:string|null;stageLink?:string|null;description:string;semester:string;stage:'orders'|'collection';status:'active'|'archived';version:number};
export type Product={id:string;name:string;description:string;sku:string;category:string;categoryId:string|null;mode:'physical'|'preorder';campaignId?:string;campaignName?:string;status:'active'|'archived';costCents:number|null;saleCents:number|null;version:number};
export type Variant={id:string;productId:string;name:string;sku:string;attributes:Record<string,string>|null;status:'active'|'archived';physicalQuantity:number;reservedQuantity:number;availableQuantity:number};
export type Combo={id:string;campaignId:string;name:string;description:string;pricingMode:'manual'|'percentage';manualPriceCents:number|null;discountBasisPoints:number|null;baseCents:number;priceCents:number;status:'active'|'archived';version:number};
export type ComboItem={comboId:string;variantId:string;quantity:number};
export type Catalog={products:Product[];variants:Variant[];campaigns:Campaign[];categories:Category[];links:{campaignId:string;productId:string}[];combos:Combo[];comboItems:ComboItem[];canManage:boolean};
export const money=(value:number|null)=>value==null?'A definir':(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
