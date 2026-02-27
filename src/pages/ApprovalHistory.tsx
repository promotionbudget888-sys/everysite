import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Eye, Loader2, Search, History } from "lucide-react";
import { apiPost } from "@/lib/api";
import { getStatusConfig } from "@/lib/statusUtils";

interface Request {
  id: string;
  title: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  description: string | null;
  admin_notes: string | null;
  zone_approver_notes: string | null;
  final_notes: string | null;
  request_type: string | null;
  size: string | null;
  size_code: string | null;
  requester_name: string;
  requester_email: string;
  requester_affiliation: string | null;
  requester_branch: string | null;
}

export default function ApprovalHistory() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => { if (profile?.zone_id) fetchHistoryRequests(); }, [profile?.zone_id]);

  const fetchHistoryRequests = async () => {
    setLoading(true);
    try {
      const res = await apiPost({ mode: "list", zone_id: profile?.zone_id || "", status: "history" });
      if (res.success && Array.isArray(res.data)) {
        setRequests(res.data);
      } else {
        setRequests([]);
      }
    } catch { setRequests([]); }
    finally { setLoading(false); }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatCurrency = (amount: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(amount));

  const getStatusBadge = (status: string) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return <Badge variant="outline" className={config.color}><Icon className="h-3 w-3 mr-1" />{config.label}</Badge>;
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.requester_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    approved: requests.filter((r) => ["zone_review_2", "admin_finalize", "approved", "competing", "paid"].includes(r.status)).length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    total: requests.length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ประวัติการอนุมัติ</h1>
          <p className="text-muted-foreground">ดูประวัติคำขอที่คุณได้ดำเนินการอนุมัติหรือปฏิเสธ</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle><History className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">อนุมัติ</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold text-success">{stats.approved}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">ปฏิเสธ</CardTitle><XCircle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{stats.rejected}</div></CardContent></Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="ค้นหาชื่อคำขอ, ผู้ขอ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="กรองตามสถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                  <SelectItem value="competing">กำลังแข่งขัน</SelectItem>
                  <SelectItem value="paid">อนุมัติจ่ายแล้ว</SelectItem>
                  <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>รายการคำขอ</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filteredRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">ไม่พบรายการ</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รหัส</TableHead>
                      <TableHead>ชื่อคำขอ</TableHead>
                      <TableHead>ผู้ขอ</TableHead>
                      <TableHead>จำนวนเงิน</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>วันที่ดำเนินการ</TableHead>
                      <TableHead className="text-right">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-sm">{request.size_code || request.id.slice(0, 8)}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{request.title}</TableCell>
                        <TableCell><div><p className="font-medium">{request.requester_name}</p><p className="text-xs text-muted-foreground">{request.requester_affiliation}</p></div></TableCell>
                        <TableCell>{formatCurrency(request.amount)}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>{formatDate(request.updated_at)}</TableCell>
                        <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => { setSelectedRequest(request); setViewDialogOpen(true); }}><Eye className="h-4 w-4 mr-1" />ดู</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>รายละเอียดคำขอ</DialogTitle></DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">ชื่อคำขอ</p><p className="font-medium">{selectedRequest.title}</p></div>
                <div><p className="text-sm text-muted-foreground">จำนวนเงิน</p><p className="font-bold text-lg">{formatCurrency(selectedRequest.amount)}</p></div>
                <div><p className="text-sm text-muted-foreground">สถานะ</p>{getStatusBadge(selectedRequest.status)}</div>
                <div><p className="text-sm text-muted-foreground">ผู้ขอ</p><p className="font-medium">{selectedRequest.requester_name}</p></div>
              </div>
              {selectedRequest.description && <div><p className="text-sm text-muted-foreground">รายละเอียด</p><p className="whitespace-pre-wrap">{selectedRequest.description}</p></div>}
              {selectedRequest.admin_notes && <div className="bg-muted p-3 rounded-lg"><p className="text-sm text-muted-foreground">หมายเหตุจาก Admin</p><p className="whitespace-pre-wrap">{selectedRequest.admin_notes}</p></div>}
              {selectedRequest.zone_approver_notes && <div className="bg-primary/5 p-3 rounded-lg border border-primary/20"><p className="text-sm text-muted-foreground">หมายเหตุของคุณ</p><p className="whitespace-pre-wrap">{selectedRequest.zone_approver_notes}</p></div>}
              {selectedRequest.final_notes && <div className="bg-success/5 p-3 rounded-lg border border-success/20"><p className="text-sm text-muted-foreground">หมายเหตุขั้นสุดท้าย</p><p className="whitespace-pre-wrap">{selectedRequest.final_notes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
