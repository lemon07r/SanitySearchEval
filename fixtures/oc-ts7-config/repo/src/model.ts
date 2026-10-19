export interface Stock {
  sku: string;
  quantity: number;
}

export function available(stock: Stock): boolean {
  return stock.quantity > 0;
}
