import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { DocumentDialog, emptyDraft, type DocumentDraft } from "@/components/sales/document-dialog";
import { docNumber, formatMoney, lineTotals, useSales, type OrderRecord } from "@/components/sales/sales-provider";

export const Route = createFileRoute("/_authenticated/m/sales/orders")({ component: OrdersPage });

function OrdersPage() {
  const { orders, orderItems, products, customers, saveOrder, deleteOrder, setOrderStatus, fulfillOrder, metrics } = useSales();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRecord | null>(null);
  const [detail, setDetail] = useState<OrderRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OrderRecord | null>(null);

  const itemsOf = (id: string) => orderItems.filter((item) => item.orderId === id);

  const draftFor = (row: OrderRecord | null): DocumentDraft =>
    row
      ? {
          customerId: row.customerId,
          customerName: row.customerName,
          date: row.orderDate,
          secondDate: row.deliveryDate,
          discountAmount: row.discountAmount,
          notes: row.notes,
          status: row.status,
          items: itemsOf(row.id).map(({ productId, productName, quantity, unitPrice, taxAmount, lineTotal }) => ({ productId, productName, quantity, unitPrice, taxAmount, lineTotal })),
        }
      : emptyDraft("Pending");

  const submit = (draft: DocumentDraft) => {
    const totals = lineTotals(draft.items, draft.discountAmount);
    void saveOrder(
      {
        orderNo: editing?.orderNo ?? docNumber("SO"),
        customerId: draft.customerId,
        customerName: draft.customerName || "Walk-in customer",
        orderDate: draft.date,
        deliveryDate: draft.secondDate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: draft.discountAmount,
        total: totals.total,
        notes: draft.notes,
        status: draft.status as OrderRecord["status"],
      },
      draft.items,
      editing?.id,
    ).then(() => {
      toast.success(editing ? "Order updated" : "Order created");
      setFormOpen(false);
    });
  };

  return (
    <TaxWorkspace
      title="Sales Orders"
      subtitle="Confirmed customer orders waiting to be fulfilled"
      icon={ClipboardList}
      backTo="/m/sales"
      backLabel="Back to Sales"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={() => { setEditing(null); setFormOpen(true); }}>New order</Button>
      }
    >
      <SummaryStrip items={[{ label: "Order value", value: formatMoney(metrics.orderTotal), hint: `${metrics.orderCount} orders`, accent: true }]} />

      <TaxTable
        rows={orders}
        searchKeys={(row) => `${row.orderNo} ${row.customerName} ${row.orderDate}`}
        filter={{
          label: "Status",
          options: ["Pending", "Confirmed", "Fulfilled", "Cancelled"].map((value) => ({ value, label: value })),
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "orderNo", label: "Order", render: (row) => <span className="font-medium text-white">{row.orderNo}</span> },
          { key: "customerName", label: "Customer" },
          { key: "deliveryDate", label: "Delivery", render: (row) => row.deliveryDate || "—", hideOnMobile: true },
          { key: "total", label: "Total", render: (row) => formatMoney(row.total) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        rowActions={(row) => [
          { label: "View details", onSelect: () => setDetail(row) },
          { label: "Edit", onSelect: () => { setEditing(row); setFormOpen(true); } },
          { label: "Mark confirmed", onSelect: () => void setOrderStatus(row.id, "Confirmed").then(() => toast.success("Order confirmed")) },
          { label: "Fulfil & invoice", onSelect: () => void fulfillOrder(row.id).then(() => toast.success("Order fulfilled — stock updated")) },
          { label: "Cancel order", onSelect: () => void setOrderStatus(row.id, "Cancelled").then(() => toast.success("Order cancelled")) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(list) => exportCsv("sales-orders.csv", ["Order", "Customer", "Delivery", "Total", "Status"], list.map((row) => [row.orderNo, row.customerName, row.deliveryDate, row.total, row.status]))}
        addLabel="New order"
        onAdd={() => { setEditing(null); setFormOpen(true); }}
        empty={{ title: "No sales orders", description: "Create an order to plan a future delivery.", icon: ClipboardList }}
      />

      <DocumentDialog
        open={formOpen}
        title={editing ? "Edit sales order" : "New sales order"}
        description="Stock is reduced only when the order is fulfilled."
        submitLabel={editing ? "Update" : "Create"}
        dateLabel="Order date"
        secondDateLabel="Delivery date"
        statusOptions={["Pending", "Confirmed", "Fulfilled", "Cancelled"]}
        products={products}
        customers={customers}
        initial={draftFor(editing)}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.orderNo ?? "Order"}
        description="Sales order details"
        rows={
          detail
            ? [
                { label: "Customer", value: detail.customerName },
                { label: "Order date", value: detail.orderDate },
                { label: "Delivery", value: detail.deliveryDate || "—" },
                { label: "Items", value: itemsOf(detail.id).map((item) => `${item.productName} x${item.quantity}`).join(", ") || "—" },
                { label: "Total", value: formatMoney(detail.total) },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <Button className="bg-amber-400 text-black hover:bg-amber-300" onClick={() => { void fulfillOrder(detail.id); setDetail(null); }}>Fulfil &amp; invoice</Button>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete sales order"
        description={`${pendingDelete?.orderNo ?? ""} will be removed.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void deleteOrder(pendingDelete.id).then(() => toast.success("Order deleted")); }}
      />
    </TaxWorkspace>
  );
}
