import { PublicPortal } from './PublicPortal';

// Public and internal buyers use the same catalog, selection and own orders.
export function CommercialShop(){return <PublicPortal embedded/>;}
