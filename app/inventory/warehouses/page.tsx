"use client";
import Header from "@/components/layout/Header";
import { PageWrapper, EmptyState } from "@/components/ui";
import { Plus } from "lucide-react";
export default function Page() {
  return (
    <>
      <Header title="Warehouses" subtitle="Inventory Module" actions={<button className="btn-primary"><Plus className="w-3.5 h-3.5" /> New</button>} />
      <PageWrapper>
        <div className="card">
          <EmptyState title="Warehouses" description="This module is ready. Connect to Supabase to load data." action={<button className="btn-primary"><Plus className="w-3.5 h-3.5" /> New</button>} />
        </div>
      </PageWrapper>
    </>
  );
}
