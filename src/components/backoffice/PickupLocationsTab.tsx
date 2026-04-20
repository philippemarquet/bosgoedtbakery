import { useState, useEffect, useCallback } from "react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { Plus, Pencil, Trash2, Search, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface PickupLocation {
  id: string;
  title: string;
  street: string;
  house_number: string | null;
  postal_code: string;
  city: string;
  is_active: boolean;
  created_at: string;
}

const StatusChip = ({ active }: { active: boolean }) => {
  const cls = active
    ? "bg-foreground text-background ring-1 ring-inset ring-foreground"
    : "bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/60";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] uppercase rounded-[calc(var(--radius)-4px)] ${cls}`}
    >
      {active ? "Actief" : "Inactief"}
    </span>
  );
};

const PickupLocationsTab = () => {
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<PickupLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    street: "",
    house_number: "",
    postal_code: "",
    city: "",
    is_active: true,
  });

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pickup_locations")
      .select("*")
      .order("title");

    if (error) {
      toast({ title: "Fout", description: "Kon afhaallocaties niet laden", variant: "destructive" });
    } else {
      setLocations(data || []);
    }
    setLoading(false);
  };

  const refreshLocations = useCallback(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchLocations();
  }, []);

  useVisibilityRefresh(refreshLocations);

  useEffect(() => {
    if (dialogOpen) {
      if (editingLocation) {
        setFormData({
          title: editingLocation.title,
          street: editingLocation.street,
          house_number: editingLocation.house_number || "",
          postal_code: editingLocation.postal_code,
          city: editingLocation.city,
          is_active: editingLocation.is_active,
        });
      } else {
        setFormData({
          title: "",
          street: "",
          house_number: "",
          postal_code: "",
          city: "",
          is_active: true,
        });
      }
    }
  }, [dialogOpen, editingLocation]);

  const filteredLocations = locations.filter((l) =>
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingLocation(null);
    setDialogOpen(true);
  };

  const openEditDialog = (location: PickupLocation) => {
    setEditingLocation(location);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.street.trim() || !formData.postal_code.trim() || !formData.city.trim()) {
      toast({ title: "Fout", description: "Vul alle verplichte velden in", variant: "destructive" });
      return;
    }

    setSaving(true);

    const payload = {
      title: formData.title.trim(),
      street: formData.street.trim(),
      house_number: formData.house_number.trim() || null,
      postal_code: formData.postal_code.trim(),
      city: formData.city.trim(),
      is_active: formData.is_active,
    };

    if (editingLocation) {
      const { error } = await supabase
        .from("pickup_locations")
        .update(payload)
        .eq("id", editingLocation.id);

      if (error) {
        toast({ title: "Fout", description: "Kon locatie niet bijwerken", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Opgeslagen", description: "Afhaallocatie bijgewerkt" });
    } else {
      const { error } = await supabase.from("pickup_locations").insert(payload);

      if (error) {
        toast({ title: "Fout", description: "Kon locatie niet aanmaken", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Toegevoegd", description: "Nieuwe afhaallocatie aangemaakt" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchLocations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze afhaallocatie wilt verwijderen?")) return;

    const { error } = await supabase.from("pickup_locations").delete().eq("id", id);

    if (error) {
      toast({ title: "Fout", description: "Kon locatie niet verwijderen", variant: "destructive" });
      return;
    }
    toast({ title: "Verwijderd", description: "Afhaallocatie verwijderd" });
    fetchLocations();
  };

  const formatAddress = (location: PickupLocation) => {
    const parts = [location.street];
    if (location.house_number) parts[0] += ` ${location.house_number}`;
    parts.push(`${location.postal_code} ${location.city}`);
    return parts.join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="bakery-eyebrow mb-2">Back-office</p>
          <h2
            className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Afhaallocaties
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Adressen waar klanten hun bestelling op kunnen halen.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek afhaallocatie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Nieuwe locatie
          </Button>
        </div>
      </div>

      <div className="paper-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Naam
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Adres
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-center">
                  Status
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                    <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
                    <p className="text-sm">Laden…</p>
                  </TableCell>
                </TableRow>
              ) : filteredLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-muted-foreground text-sm">
                    {searchQuery ? "Geen locaties gevonden." : "Nog geen afhaallocaties. Maak er een aan."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLocations.map((location) => (
                  <TableRow key={location.id} className="border-b border-border/40 hover:bg-muted/40">
                    <TableCell className="py-3 w-10 pl-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        onClick={() => openEditDialog(location)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">{location.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {formatAddress(location)}
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <StatusChip active={location.is_active} />
                    </TableCell>
                    <TableCell className="py-3 w-10 pr-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        onClick={() => handleDelete(location.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader className="space-y-2">
            <p className="bakery-eyebrow">Afhaallocatie</p>
            <DialogTitle
              className="font-serif text-2xl md:text-3xl font-medium text-foreground leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              {editingLocation ? "Bewerken" : "Nieuwe locatie"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Naam *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="bijv. Bakkerij Centrum"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="street">Straat *</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="Hoofdstraat"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="house_number">Huisnummer</Label>
                <Input
                  id="house_number"
                  value={formData.house_number}
                  onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">Postcode *</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="1234 AB"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Plaats *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Amsterdam"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-[calc(var(--radius)-2px)] border border-border/60 bg-muted/20 px-3 py-2.5">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="text-sm font-normal text-foreground">
                Actief (zichtbaar voor klanten)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Opslaan…" : editingLocation ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PickupLocationsTab;
