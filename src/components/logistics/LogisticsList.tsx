import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ExternalLink, Copy, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Collection {
  id: string;
  bike_id: string;
  status: string;
  tracking_number: string | null;
  sender_name: string;
  sender_email: string;
  address_street: string;
  address_city: string;
  address_postcode: string;
  scheduled_date: string | null;
  created_at: string;
  bikes: {
    make: string;
    model: string;
    frame_number: string | null;
  } | null;
}

interface LogisticsListProps {
  status: "active" | "completed";
}

const LogisticsList = ({ status }: LogisticsListProps) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadCollections = async () => {
    try {
      setLoading(true);
      
      const statuses = status === "active" 
        ? ["pending", "scheduled", "driver_to_collection", "collected", "driver_to_delivery"]
        : ["delivered", "cancelled", "failed"];

      const { data, error } = await supabase
        .from("bike_collections")
        .select(`
          *,
          bikes (
            make,
            model,
            frame_number
          )
        `)
        .in("status", statuses)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading collections",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, [status]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      scheduled: { variant: "default", label: "Scheduled" },
      driver_to_collection: { variant: "default", label: "Driver En Route" },
      collected: { variant: "default", label: "Collected" },
      driver_to_delivery: { variant: "default", label: "In Transit" },
      delivered: { variant: "default", label: "Delivered" },
      cancelled: { variant: "outline", label: "Cancelled" },
      failed: { variant: "destructive", label: "Failed" },
    };

    const statusInfo = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const copyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber);
    toast({
      title: "Copied",
      description: "Tracking number copied to clipboard",
    });
  };

  const filteredCollections = collections.filter((collection) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      collection.bikes?.make.toLowerCase().includes(query) ||
      collection.bikes?.model.toLowerCase().includes(query) ||
      collection.sender_name.toLowerCase().includes(query) ||
      collection.tracking_number?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading collections...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by bike, sender, or tracking number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={loadCollections}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {filteredCollections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "No collections found matching your search" : "No collections found"}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bike</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tracking Number</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCollections.map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell className="font-medium">
                    {collection.bikes ? (
                      <div>
                        <div>{collection.bikes.make} {collection.bikes.model}</div>
                        {collection.bikes.frame_number && (
                          <div className="text-xs text-muted-foreground">
                            {collection.bikes.frame_number}
                          </div>
                        )}
                      </div>
                    ) : (
                      "Unknown"
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(collection.status)}</TableCell>
                  <TableCell>
                    {collection.tracking_number ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{collection.tracking_number}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyTrackingNumber(collection.tracking_number!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div>{collection.sender_name}</div>
                      <div className="text-xs text-muted-foreground">{collection.sender_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{collection.address_street}</div>
                      <div className="text-muted-foreground">
                        {collection.address_city}, {collection.address_postcode}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {collection.scheduled_date
                      ? format(new Date(collection.scheduled_date), "MMM d, yyyy HH:mm")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(collection.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/bikes?bike=${collection.bike_id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default LogisticsList;
