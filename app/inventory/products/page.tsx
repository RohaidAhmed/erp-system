"use client";

import { useEffect, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatCurrency } from "@/components/ui";
import type { Product } from "@/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const load = () => {
    setLoading(true);
    fetch("/api/inventory/products?pageSize=50")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setProducts(res.data); setTotal(res.pagination?.totalCount || 0); }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <Header
        title="Product Catalog"
        subtitle="Inventory Module"
        actions={<button className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Product</button>}
      />
      <PageWrapper>
        <SectionTitle title="Products" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="text-left table-header px-4 py-3">SKU</th>
                  <th className="text-left table-header px-4 py-3">Name</th>
                  <th className="text-left table-header px-4 py-3">Category</th>
                  <th className="text-right table-header px-4 py-3">On Hand</th>
                  <th className="text-right table-header px-4 py-3">Reorder Point</th>
                  <th className="text-right table-header px-4 py-3">Unit Cost</th>
                  <th className="text-right table-header px-4 py-3">Unit Price</th>
                  <th className="text-left table-header px-4 py-3">UoM</th>
                  <th className="text-left table-header px-4 py-3">Stock</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9}><TableSkeleton rows={8} cols={9} /></td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={9}><EmptyState title="No products found" description="Add your first product." /></td></tr>
                ) : (
                  products.map((p) => {
                    const isLowStock = p.quantity_on_hand <= p.reorder_point;
                    return (
                      <tr key={p.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{p.sku}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className="badge bg-surface-200 text-gray-600">{p.category}</span>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${isLowStock ? "text-red-600" : "text-gray-900"}`}>
                          {p.quantity_on_hand.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{p.reorder_point.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.unit_cost)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.unit_price)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{p.unit_of_measure}</td>
                        <td className="px-4 py-3">
                          {isLowStock ? (
                            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                              <AlertTriangle className="w-3 h-3" /> Low Stock
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>
    </>
  );
}
