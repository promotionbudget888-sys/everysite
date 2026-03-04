import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  FileText,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trophy,
  Banknote,
} from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { apiPost } from "@/lib/api";
import {
  getStatusConfig,
  STATUS_FILTER_OPTIONS,
} from "@/lib/statusUtils";

interface Request {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  requester_id: string;
  zone_id: string;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  requester_email?: string;
}

export default function AllRequests() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [actionType, setActionType] = useState("approve");
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const canView = profile?.role === "admin";

  useEffect(() => {
    if (canView) fetchRequests();
  }, [canView]);

  const fetchRequests = async () => {
    try {
      setLoading(true);

      const res = await apiPost({ mode: "list" });

      if (res.success && Array.isArray(res.data)) {
        const valid = res.data.filter((r: Request) => r.id && r.title);

        valid.sort(
          (a: Request, b: Request) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

        setRequests(valid);
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("fetchRequests error", err);
      toast({
        title: "โหลดข้อมูลไม่สำเร็จ",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.requester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false);

    const matchesStatus =
      filterStatus === "all" || req.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const openActionDialog = (request: Request, action: string) => {
    setSelectedRequest(request);
    setActionType(action);
    setActionNotes("");
    setActionDialogOpen(true);
  };

  const getNewStatus = (action: string): string => {
    switch (action) {
      case "reject":
        return "rejected";
      case "return":
        return "returned";
      case "review":
        return "zone_review_1";
      case "finalize":
        return "approved";
      case "set_competing":
        return "competing";
      case "set_paid":
        return "paid";
      default:
        return "submitted";
    }
  };

  const handleAction = async () => {
    if (!selectedRequest || !selectedRequest.id) return;

    try {
      setActionLoading(true);

      const newStatus = getNewStatus(actionType);

      const payload = {
        mode:
          actionType === "review" || actionType === "finalize"
            ? "approve"
            : actionType,
        id: selectedRequest.id,
        status: newStatus,
        notes: actionNotes || "",
        rejected_reason: actionType === "reject" ? actionNotes || "" : "",
      };

      const res = await apiPost(payload);

      if (!res.success) {
        console.error("API ERROR", res);

        toast({
          title: "เกิดข้อผิดพลาด",
          variant: "destructive",
        });

        return;
      }

      toast({ title: "ดำเนินการสำเร็จ" });

      setActionDialogOpen(false);

      fetchRequests();
    } catch (err) {
      console.error("handleAction error", err);

      toast({
        title: "เกิดข้อผิดพลาด",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));

  const safeFormatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      return format(d, "dd MMM yyyy HH:mm", { locale: th });
    } catch {
      return "-";
    }
  };

  if (!canView) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <section className="space-y-6">

        {/* HEADER */}

        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            คำขอทั้งหมด
          </h1>

          <Button
            variant="outline"
            onClick={fetchRequests}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                loading ? "animate-spin" : ""
              }`}
            />
            รีเฟรช
          </Button>
        </header>

        {/* SEARCH */}

        <Card>
          <CardHeader>
            <CardTitle>ค้นหาและกรอง</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-3">

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อคำขอ..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select
              value={filterStatus}
              onValueChange={setFilterStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>

                {STATUS_FILTER_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </CardContent>
        </Card>

        {/* TABLE */}

        <Card>
          <CardHeader>
            <CardTitle>
              รายการคำขอ ({filteredRequests.length})
            </CardTitle>
          </CardHeader>

          <CardContent>

            <Table>

              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ชื่อคำขอ</TableHead>
                  <TableHead>ผู้ขอ</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>

                {filteredRequests.map((req) => (
                  <TableRow key={req.id}>

                    <TableCell>
                      {safeFormatDate(req.created_at)}
                    </TableCell>

                    <TableCell className="font-medium">
                      {req.title}
                    </TableCell>

                    <TableCell>
                      {req.requester_name}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatCurrency(req.amount)}
                    </TableCell>

                    <TableCell>
                      {getStatusBadge(req.status)}
                    </TableCell>

                    <TableCell className="text-right">

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRequest(req);
                          setViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        ดู
                      </Button>

                    </TableCell>

                  </TableRow>
                ))}

              </TableBody>

            </Table>

          </CardContent>
        </Card>

      </section>
    </AppLayout>
  );
}
