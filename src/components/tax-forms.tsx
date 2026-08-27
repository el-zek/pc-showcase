import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TaxModal({ open, title, description, children, onClose }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-xl border-white/10 bg-[#111827] text-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-white/70">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function SaleForm({ open, initialValue, onSave, onClose }: { open: boolean; initialValue?: { reference?: string; customer?: string; date?: string; amount?: number; vat?: number; status?: string }; onSave: (value: { reference: string; customer: string; date: string; amount: number; vat: number; status: string }) => void; onClose: () => void }) {
  const [reference, setReference] = useState(initialValue?.reference ?? "");
  const [customer, setCustomer] = useState(initialValue?.customer ?? "");
  const [date, setDate] = useState(initialValue?.date ?? "");
  const [amount, setAmount] = useState(initialValue?.amount?.toString() ?? "");
  const [vat, setVat] = useState(initialValue?.vat?.toString() ?? "");
  const [status, setStatus] = useState(initialValue?.status ?? "Recorded");

  useEffect(() => {
    setReference(initialValue?.reference ?? "");
    setCustomer(initialValue?.customer ?? "");
    setDate(initialValue?.date ?? "");
    setAmount(initialValue?.amount?.toString() ?? "");
    setVat(initialValue?.vat?.toString() ?? "");
    setStatus(initialValue?.status ?? "Recorded");
  }, [initialValue, open]);

  const handleSave = () => {
    if (!reference || !customer || !date || !amount || !vat) return;
    onSave({ reference, customer, date, amount: Number(amount), vat: Number(vat), status });
    onClose();
  };

  return (
    <TaxModal open={open} title="Create sales record" description="Capture the sale and VAT impact for your tax register." onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label>Reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div>
          <Label>Customer</Label>
          <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Recorded">Recorded</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>VAT</Label>
            <Input type="number" value={vat} onChange={(e) => setVat(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save record</Button>
      </DialogFooter>
    </TaxModal>
  );
}

export function PurchaseForm({ open, initialValue, onSave, onClose }: { open: boolean; initialValue?: { supplier?: string; date?: string; amount?: number; deductible?: boolean; category?: string; status?: string }; onSave: (value: { supplier: string; date: string; amount: number; deductible: boolean; category: string; status: string }) => void; onClose: () => void }) {
  const [supplier, setSupplier] = useState(initialValue?.supplier ?? "");
  const [date, setDate] = useState(initialValue?.date ?? "");
  const [amount, setAmount] = useState(initialValue?.amount?.toString() ?? "");
  const [deductible, setDeductible] = useState(initialValue?.deductible ?? true);
  const [category, setCategory] = useState(initialValue?.category ?? "Inventory");
  const [status, setStatus] = useState(initialValue?.status ?? "Verified");

  useEffect(() => {
    setSupplier(initialValue?.supplier ?? "");
    setDate(initialValue?.date ?? "");
    setAmount(initialValue?.amount?.toString() ?? "");
    setDeductible(initialValue?.deductible ?? true);
    setCategory(initialValue?.category ?? "Inventory");
    setStatus(initialValue?.status ?? "Verified");
  }, [initialValue, open]);

  const handleSave = () => {
    if (!supplier || !date || !amount || !category) return;
    onSave({ supplier, date, amount: Number(amount), deductible, category, status });
    onClose();
  };

  return (
    <TaxModal open={open} title="Create purchase" description="Capture purchase activity for tax deduction review." onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label>Supplier</Label>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={deductible} onChange={(e) => setDeductible(e.target.checked)} />
          <Label>Eligible for deduction</Label>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save purchase</Button>
      </DialogFooter>
    </TaxModal>
  );
}

export function ExpenseForm({ open, initialValue, onSave, onClose }: { open: boolean; initialValue?: { description?: string; category?: string; amount?: number; deductible?: boolean; receipt?: boolean; status?: string }; onSave: (value: { description: string; category: string; amount: number; deductible: boolean; receipt: boolean; status: string }) => void; onClose: () => void }) {
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [category, setCategory] = useState(initialValue?.category ?? "Operations");
  const [amount, setAmount] = useState(initialValue?.amount?.toString() ?? "");
  const [deductible, setDeductible] = useState(initialValue?.deductible ?? true);
  const [receipt, setReceipt] = useState(initialValue?.receipt ?? true);
  const [status, setStatus] = useState(initialValue?.status ?? "Approved");

  useEffect(() => {
    setDescription(initialValue?.description ?? "");
    setCategory(initialValue?.category ?? "Operations");
    setAmount(initialValue?.amount?.toString() ?? "");
    setDeductible(initialValue?.deductible ?? true);
    setReceipt(initialValue?.receipt ?? true);
    setStatus(initialValue?.status ?? "Approved");
  }, [initialValue, open]);

  const handleSave = () => {
    if (!description || !category || !amount) return;
    onSave({ description, category, amount: Number(amount), deductible, receipt, status });
    onClose();
  };

  return (
    <TaxModal open={open} title="Create expense" description="Record deductible spending and evidence status." onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Approved">Approved</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={deductible} onChange={(e) => setDeductible(e.target.checked)} /> Deductible</label>
            <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} /> Receipt</label>
          </div>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save expense</Button>
      </DialogFooter>
    </TaxModal>
  );
}

export function VatForm({ open, onSave, onClose }: { open: boolean; onSave: (value: { period: string; outputVat: number; inputVat: number; payable: number; status: string }) => void; onClose: () => void }) {
  const [period, setPeriod] = useState("");
  const [outputVat, setOutputVat] = useState("");
  const [inputVat, setInputVat] = useState("");
  const [status, setStatus] = useState("Draft");

  const handleSave = () => {
    if (!period || !outputVat || !inputVat) return;
    onSave({ period, outputVat: Number(outputVat), inputVat: Number(inputVat), payable: Math.max(0, Number(outputVat) - Number(inputVat)), status });
    onClose();
  };

  return (
    <TaxModal open={open} title="Create VAT return" description="Prepare a VAT return for filing." onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label>Period</Label>
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Output VAT</Label>
            <Input type="number" value={outputVat} onChange={(e) => setOutputVat(e.target.value)} />
          </div>
          <div>
            <Label>Input VAT</Label>
            <Input type="number" value={inputVat} onChange={(e) => setInputVat(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Filed">Filed</SelectItem></SelectContent></Select>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save return</Button>
      </DialogFooter>
    </TaxModal>
  );
}

export function WithholdingForm({ open, onSave, onClose }: { open: boolean; onSave: (value: { name: string; type: string; amount: number; status: string }) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Service");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("Pending");

  const handleSave = () => {
    if (!name || !type || !amount) return;
    onSave({ name, type, amount: Number(amount), status });
    onClose();
  };

  return (
    <TaxModal open={open} title="Create withholding entry" description="Register a withholding certificate or payment item." onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Type</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Issued">Issued</SelectItem><SelectItem value="Received">Received</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select>
          </div>
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save entry</Button>
      </DialogFooter>
    </TaxModal>
  );
}

export function AssetForm({ open, onSave, onClose }: { open: boolean; onSave: (value: { name: string; category: string; purchaseValue: number; currentValue: number; depreciation: number; usefulLife: number; status: string }) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Vehicle");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [depreciation, setDepreciation] = useState("");
  const [usefulLife, setUsefulLife] = useState("");
  const [status, setStatus] = useState("Active");

  const handleSave = () => {
    if (!name || !category || !purchaseValue || !currentValue || !depreciation || !usefulLife) return;
    onSave({ name, category, purchaseValue: Number(purchaseValue), currentValue: Number(currentValue), depreciation: Number(depreciation), usefulLife: Number(usefulLife), status });
    onClose();
  };

  return (
    <TaxModal open={open} title="Create asset" description="Track capital assets and depreciation for tax benefit." onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Disposed">Disposed</SelectItem></SelectContent></Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Purchase Value</Label>
            <Input type="number" value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value)} />
          </div>
          <div>
            <Label>Current Value</Label>
            <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Depreciation</Label>
            <Input type="number" value={depreciation} onChange={(e) => setDepreciation(e.target.value)} />
          </div>
          <div>
            <Label>Useful Life (years)</Label>
            <Input type="number" value={usefulLife} onChange={(e) => setUsefulLife(e.target.value)} />
        </div>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save asset</Button>
      </DialogFooter>
    </TaxModal>
  );
}

export function DocumentForm({ open, onSave, onClose }: { open: boolean; onSave: (value: { name: string; category: string; type: string; size: string; status: string; uploadedAt: string }) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Invoice");
  const [type, setType] = useState("PDF");
  const [size, setSize] = useState("1.0 MB");
  const [status, setStatus] = useState("Pending");

  const handleSave = () => {
    if (!name) return;
    onSave({ name, category, type, size, status, uploadedAt: new Date().toISOString().slice(0, 10) });
    onClose();
  };

  return (
    <TaxModal open={open} title="Upload document" description="Upload a supporting tax document." onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label>File name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Type</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} />
          </div>
          <div>
            <Label>Size</Label>
            <Input value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save document</Button>
      </DialogFooter>
    </TaxModal>
  );
}
