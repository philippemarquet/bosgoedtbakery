import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    fetchLocations();
  }, []);

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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Zoek afhaallocatie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>
        <Button onClick={openCreateDialog} size="sm" className="font-normal">
          <Plus className="w-4 h-4 mr-2" />
          Nieuwe locatie
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Naam</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Adres</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredLocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "Geen locaties gevonden" : "Nog geen afhaallocaties. Maak er een aan!"}
                </TableCell>
              </TableRow>
            ) : (
              filteredLocations.map((location) => (
                <TableRow key={location.id} className="border-0 hover:bg-muted/30">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-normal">{location.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {formatAddress(location)}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    {location.is_active ? (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-0">Actief</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">Inactief</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(location)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(location.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Afhaallocatie bewerken" : "Nieuwe afhaallocatie"}
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

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Actief (zichtbaar voor klanten)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Opslaan..." : editingLocation ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PickupLocationsTab;
