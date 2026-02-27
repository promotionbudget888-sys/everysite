import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, FileText, RefreshCw, Eye, CheckCircle, XCircle, RotateCcw, Send, Ban, Trophy, Banknote } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { apiPost } from "@/lib/api";
import { getStatusConfig, STATUS_FILTER_OPTIONS, canTransitionTo } from "@/lib/statusUtils";

interface Request {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  requester_id: string;
  zone_id: string;
  admin_notes: string | null;
  zone_approver_notes: string | null;
  final_notes: string | null;
  request_type: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  requester_email?: string;
  zone_name?: string;
}

export default function AllRequests() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [actionType, setActionType] = useState<string>("approve");
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const canView = profile?.role === "admin";

  useEffect(() => { if (canView) fetchRequests(); }, [canView]);

  const fetchRequests = async () => {
    setLoading(true);
    const res = await apiPost({ mode: "list" });
    if (res.success && Array.isArray(res.data)) {
      const valid = res.data.filter((r: Request) => r.id && r.title);
      valid.sort((a: Request, b: Request) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRequests(valid);
    } else {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
      setRequests([]);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return <Badge variant="outline" className={config.color}><Icon className="h-3 w-3 mr-1" />{config.label}</Badge>;
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) || (req.requester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = filterStatus === "all" || req.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: requests.length,
    submitted: requests.filter((r) => r.status === "submitted").length,
    admin_finalize: requests.filter((r) => r.status === "admin_finalize").length,
    approved: requests.filter((r) => r.status === "approved" || r.status === "competing" || r.status === "paid").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const openActionDialog = (request: Request, action: string) => {
    setSelectedRequest(request);
    setActionType(action);
    setActionNotes("");
    setActionDialogOpen(true);
  };

  const getNewStatus = (currentStatus: string, action: string): string => {
    if (action === "reject") return "rejected";
    if (action === "return") return "returned";
    if (action === "review") return "zone_review_1"; // Admin review → send to zone 1
    if (action === "finalize") return "approved"; // Admin final approve
    if (action === "set_competing") return "competing";
    if (action === "set_paid") return "paid";
    return currentStatus;
  };

  const handleAction = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    const newStatus = getNewStatus(selectedRequest.status, actionType);

    const res = await apiPost({
      mode: actionType === "review" || actionType === "finalize" ? "approve" : actionType,
      id: selectedRequest.id,
      status: newStatus,
      notes: actionNotes,
      rejected_reason: actionType === "reject" ? actionNotes : undefined,
    });

    if (!res.success) {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } else {
      toast({ title: "สำเร็จ" });
    }

    setActionDialogOpen(false);
    fetchRequests();
    setActionLoading(false);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "review": return "ยืนยันตรวจสอบผ่าน";
      case "finalize": return "ยืนยันอนุมัติแข่งขัน";
      case "reject": return "ยืนยันปฏิเสธ";
      case "return": return "ยืนยันตีกลับ";
      case "set_competing": return "ยืนยันอยู่ระหว่างแข่งขัน";
      case "set_paid": return "ยืนยันอนุมัติจ่าย";
      default: return "ยืนยัน";
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(amount));

  const safeFormatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || "-";
      return format(d, "dd MMM yyyy HH:mm", { locale: th });
    } catch {
      return dateStr || "-";
    }
  };

  if (!canView) {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <section className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileText className="h-6 w-6" />คำขอทั้งหมด</h1>
            <p className="text-muted-foreground">จัดการและติดตามคำขอใช้งบประมาณทั้งหมดในระบบ</p>
          </div>
          <Button variant="outline" onClick={fetchRequests} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />รีเฟรช</Button>
        </header>

        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-info">รอตรวจสอบ</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-info">{stats.submitted}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-warning">รออนุมัติขั้นสุดท้าย</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-warning">{stats.admin_finalize}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-success">อนุมัติแล้ว</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">{stats.approved}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">ปฏิเสธ</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{stats.rejected}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>ค้นหาและกรอง</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="ค้นหาชื่อคำขอ, ผู้ขอ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="สถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  {STATUS_FILTER_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}>ล้างตัวกรอง</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>รายการคำขอ ({filteredRequests.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">วันที่สร้าง</TableHead>
                    <TableHead className="min-w-[200px]">ชื่อคำขอ</TableHead>
                    <TableHead>ผู้ขอ</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right min-w-[250px]">การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto" /></TableCell></TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลคำขอ</TableCell></TableRow>
                  ) : filteredRequests.map((req, idx) => (
                    <TableRow key={req.id || `row-${idx}`}>
                      <TableCell className="text-sm tabular-nums">{safeFormatDate(req.created_at)}</TableCell>
                      <TableCell className="font-medium">{req.title}</TableCell>
                      <TableCell><div className="text-sm"><div>{req.requester_name || "-"}</div><div className="text-muted-foreground text-xs">{req.requester_email}</div></div></TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(req.amount)}</TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(req); setViewDialogOpen(true); }}><Eye className="h-4 w-4 mr-1" />ดู</Button>

                          {/* Admin: ตรวจสอบ submitted → zone_review_1 */}
                          {req.status === "submitted" && (
                            <>
                              <Button size="sm" variant="outline" className="text-success hover:text-success hover:bg-success/10" onClick={() => openActionDialog(req, "review")}><CheckCircle className="h-4 w-4 mr-1" />ตรวจสอบผ่าน</Button>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openActionDialog(req, "return")}><RotateCcw className="h-4 w-4 mr-1" />ตีกลับ</Button>
                            </>
                          )}

                          {/* Admin: admin_finalize → อนุมัติแข่งขัน / อยู่ระหว่างแข่งขัน / อนุมัติจ่าย / ปฏิเสธ */}
                          {req.status === "admin_finalize" && (
                            <>
                              <Button size="sm" variant="outline" className="text-success hover:text-success hover:bg-success/10" onClick={() => openActionDialog(req, "finalize")}><CheckCircle className="h-4 w-4 mr-1" />อนุมัติแข่งขัน</Button>
                              <Button size="sm" variant="outline" className="text-primary hover:text-primary hover:bg-primary/10" onClick={() => openActionDialog(req, "set_competing")}><Trophy className="h-4 w-4 mr-1" />อยู่ระหว่างแข่งขัน</Button>
                              <Button size="sm" variant="outline" className="text-success hover:text-success hover:bg-success/10" onClick={() => openActionDialog(req, "set_paid")}><Banknote className="h-4 w-4 mr-1" />อนุมัติจ่าย</Button>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openActionDialog(req, "reject")}><XCircle className="h-4 w-4 mr-1" />ปฏิเสธ</Button>
                            </>
                          )}

                          {/* Admin: หลัง approved → competing / paid */}
                          {req.status === "approved" && (
                            <>
                              <Button size="sm" variant="outline" className="text-primary hover:text-primary hover:bg-primary/10" onClick={() => openActionDialog(req, "set_competing")}><Trophy className="h-4 w-4 mr-1" />อยู่ระหว่างแข่งขัน</Button>
                              <Button size="sm" variant="outline" className="text-success hover:text-success hover:bg-success/10" onClick={() => openActionDialog(req, "set_paid")}><Banknote className="h-4 w-4 mr-1" />อนุมัติจ่าย</Button>
                            </>
                          )}
                          {req.status === "competing" && (
                            <Button size="sm" variant="outline" className="text-success hover:text-success hover:bg-success/10" onClick={() => openActionDialog(req, "set_paid")}><Banknote className="h-4 w-4 mr-1" />อนุมัติจ่าย</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>รายละเอียดคำขอ</DialogTitle><DialogDescription>{selectedRequest?.title}</DialogDescription></DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">ผู้ขอ</p><p className="font-medium">{selectedRequest.requester_name}</p></div>
                <div><p className="text-muted-foreground">จำนวนเงิน</p><p className="font-medium text-lg">{formatCurrency(selectedRequest.amount)}</p></div>
                <div><p className="text-muted-foreground">สถานะ</p><div className="mt-1">{getStatusBadge(selectedRequest.status)}</div></div>
              </div>
              {selectedRequest.description && <div><p className="text-muted-foreground text-sm mb-1">รายละเอียด</p><p className="bg-muted p-3 rounded-md text-sm">{selectedRequest.description}</p></div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewDialogOpen(false)}>ปิด</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "review" ? "ตรวจสอบคำขอ" : actionType === "finalize" ? "อนุมัติแข่งขัน" : actionType === "reject" ? "ปฏิเสธคำขอ" : actionType === "return" ? "ตีกลับคำขอ" : actionType === "set_competing" ? "เปลี่ยนสถานะเป็นอยู่ระหว่างแข่งขัน" : actionType === "set_paid" ? "อนุมัติจ่าย" : "ดำเนินการ"}
            </DialogTitle>
            <DialogDescription>{selectedRequest?.title} - {formatCurrency(selectedRequest?.amount || 0)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{actionType === "reject" ? "เหตุผลในการปฏิเสธ *" : "หมายเหตุ (ถ้ามี)"}</label>
              <Textarea placeholder="ระบุหมายเหตุ..." value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={3} />
              {actionType === "reject" && !actionNotes.trim() && (
                <p className="text-sm text-destructive mt-1">* กรุณาระบุเหตุผล</p>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>ยกเลิก</Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading || (actionType === "reject" && !actionNotes.trim())}
              className={actionType === "reject" || actionType === "return" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-success text-success-foreground hover:bg-success/90"}
            >
              {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : actionType === "reject" || actionType === "return" ? <XCircle className="h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {getActionLabel(actionType)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
