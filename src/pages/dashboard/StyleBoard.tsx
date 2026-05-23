import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Palette, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const StyleBoard = () => {
  const { user } = useAuth(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchItems = async () => {
      const { data } = await supabase
        .from("style_board_items")
        .select("*, style_gallery(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setItems(data || []);
      setLoading(false);
    };
    fetchItems();
  }, [user]);

  const handleRemove = async (id: string) => {
    await supabase.from("style_board_items").delete().eq("id", id);
    setItems(items.filter(i => i.id !== id));
    toast.success("Removed from style board");
  };

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">My Style Board</h1>
      <p className="text-muted-foreground mb-6 font-normal">Your saved styles and try-on results</p>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Palette className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No saved styles yet. Start a consultation to try on looks!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="glass rounded-xl border-0 overflow-hidden group hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              {item.try_on_result_url ? (
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={item.try_on_result_url} alt="Try-on" className="w-full h-full object-cover" />
                </div>
              ) : item.style_gallery?.image_url ? (
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={item.style_gallery.image_url} alt={item.style_gallery.name} className="w-full h-full object-cover" />
                </div>
              ) : null}
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.style_gallery?.name || "Custom Style"}</p>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemove(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-teal text-white rounded-full" onClick={() => navigate(`/dashboard/book?consultation=${item.consultation_id}`)}>
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StyleBoard;
