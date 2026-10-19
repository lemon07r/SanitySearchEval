import {available, type Stock} from '@app/model';

export function stockLabel(stock: Stock): string {
  return `${stock.sku}: ${available(stock) ? 'available' : 'out of stock'}`;
}
