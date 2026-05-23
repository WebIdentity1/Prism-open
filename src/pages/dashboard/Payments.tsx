import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CreditCard, DollarSign, Loader2, Search, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

interface Transaction {
  id: string;
  client_name: string;
  service_name: string;
  amount: number;
  date: string;
  status: string;
}

const Payments = () => {
  const { user } = useAuth(false);
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<{ id: string; email: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; price: number }[]>([]);

  // Quick checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [charging, setCharging] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: s } = await supabase.from("salons").select("*").eq("owner_id", user.id).maybeSingle();
      if (!s) { setLoading(false); return; }
      setSalon(s);

      // Fetch recent completed/confirmed appointments as transactions
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, start_time, status, client_id, service_id")
        .eq("salon_id", s.id)
        .in("status", ["confirmed", "completed"])
        .order("start_time", { ascending: false })
        .limit(50);

      if (appts && appts.length > 0) {
        const clientIds = [...new Set(appts.map(a => a.client_id))];
        const serviceIds = [...new Set(appts.map(a => a.service_id).filter(Boolean))];

        const [profilesRes, servicesRes] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds),
          serviceIds.length > 0
            ? supabase.from("services").select("id, name, price").in("id", serviceIds)
            : Promise.resolve({ data: [] }),
        ]);

        const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.full_name]));
        const serviceMap = new Map((servicesRes.data || []).map(s => [s.id, s]));

        setTransactions(appts.map(a => {
          const svc = a.service_id ? serviceMap.get(a.service_id) : null;
          return {
            id: a.id,
            client_name: profileMap.get(a.client_id) || "Unknown",
            service_name: svc?.name || "—",
            amount: svc?.price || 0,
            date: a.start_time,
            status: a.status,
          };
        }));
      }

      // Fetch clients for quick checkout
      const { data: allAppts } = await supabase
        .from("appointments")
        .select("client_id")
        .eq("salon_id", s.id);
      if (allAppts) {
        const uniqueClientIds = [...new Set(allAppts.map(a => a.client_id))];
        if (uniqueClientIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", uniqueClientIds);
          // We need emails — get from auth via edge function or use profile name
          setClients((profiles || []).map(p => ({
            id: p.user_id,
            email: "", // Will need to be passed differently
            name: p.full_name || "Unknown",
          })));
        }
      }

      // Fetch services for quick checkout
      const { data: svcData } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("salon_id", s.id)
        .eq("is_active", true);
      setServices(svcData || []);

      setLoading(false);
    };
    load();
  }, [user]);

  const handleQuickCharge = async () => {
    if (!selectedClient || (!selectedService && !customAmount)) return;
    setCharging(true);

    const client = clients.find(c => c.id === selectedClient);
    const svc = services.find(s => s.id === selectedService);
    const amount = customAmount ? Math.round(parseFloat(customAmount) * 100) : (svc ? Math.round(svc.price * 100) : 0);

    if (amount <= 0) {
      toast.error("Invalid amount");
      setCharging(false);
      return;
    }

    // Look up client email via edge function
    const { data: emailData, error: emailError } = await supabase.functions.invoke("lookup-client-email", {
      body: { user_id: selectedClient },
    });

    if (emailError || !emailData?.email) {
      toast.error("Could not find client email");
      setCharging(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke("charge-customer", {
      body: {
        customer_email: emailData.email,
        amount,
        description: chargeDescription || svc?.name || "In-salon service",
        salon_id: salon.id,
      },
    });

    setCharging(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Charge failed. Customer may not have a saved payment method.");
    } else {
      toast.success("Payment charged successfully!");
      setCheckoutOpen(false);
      setSelectedClient("");
      setSelectedService("");
      setCustomAmount("");
      setChargeDescription("");
    }
  };

  const todayRevenue = transactions
    .filter(t => {
      const d = new Date(t.date);
      const today = new Date();
      return d.toDateString() === today.toDateString() && t.status === "completed";
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingCount = transactions.filter(t => t.status === "confirmed").length;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!salon) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Set up your salon first to manage payments</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Manage transactions and in-salon checkout</p>
        </div>
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-prism text-white rounded-full"><Zap className="h-4 w-4 mr-2" />Quick Checkout</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Quick Checkout</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service (optional)</Label>
                <Select value={selectedService} onValueChange={(v) => { setSelectedService(v); setCustomAmount(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} — ${s.price}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Custom Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="Or enter custom amount"
                  value={customAmount}
                  onChange={e => { setCustomAmount(e.target.value); setSelectedService(""); }}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={chargeDescription}
                  onChange={e => setChargeDescription(e.target.value)}
                  placeholder="e.g. Walk-in blowout"
                />
              </div>
              <Button onClick={handleQuickCharge} disabled={charging || !selectedClient || (!selectedService && !customAmount)} className="w-full">
                {charging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Charge Saved Card
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Charges the client's saved payment method on file
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-3 mb-6">
        <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
          <CardContent className="p-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-champagne flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Revenue</p>
              <p className="text-xl font-light">${todayRevenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
          <CardContent className="p-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-prism flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-xl font-light">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
          <CardContent className="p-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-teal flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-xl font-light">{transactions.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="glass rounded-xl border-0">
        <CardHeader className="p-6">
          <CardTitle className="text-lg font-medium">Recent Transactions</CardTitle>
          <CardDescription>Appointments with confirmed or completed payments</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.client_name}</TableCell>
                    <TableCell>{t.service_name}</TableCell>
                    <TableCell>${t.amount.toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(t.date), "MMM d, h:mm a")}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === "completed" ? "badge-teal" : "badge-champagne"
                      }`}>
                        {t.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;
