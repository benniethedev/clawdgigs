import { redirect } from 'next/navigation';

// Redirect /my-orders to /orders for cleaner URL semantics
export default function MyOrdersPage() {
  redirect('/orders');
}
