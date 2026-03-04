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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, FileText, RefreshCw, Eye, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "@/lib/api";
import { getStatusConfig, STATUS_FILTER_OPTIONS } from "@/lib/statusUtils";

interface Request {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  admin_notes?: string | null;
  zone_approver_notes?: string | null;
}

export default function MyRequests() {

  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [requests,setRequests] = useState<Request[]>([]);
  const [loading,setLoading] = useState(true);

  const [searchTerm,setSearchTerm] = useState("");
  const [filterStatus,setFilterStatus] = useState("all");

  const [viewDialogOpen,setViewDialogOpen] = useState(false);
  const [selectedRequest,setSelectedRequest] = useState<Request|null>(null);

  const [deleteDialogOpen,setDeleteDialogOpen] = useState(false);
  const [requestToDelete,setRequestToDelete] = useState<Request|null>(null);
  const [isDeleting,setIsDeleting] = useState(false);

  useEffect(()=>{
    if(profile) fetchRequests();
  },[profile]);

  const fetchRequests = async ()=>{
    if(!profile) return;

    try{

      setLoading(true);

      const res = await apiPost({
        mode:"list",
        requester_id: profile.id
      });

      if(res.success && Array.isArray(res.data)){
        setRequests(res.data);
      }else{
        setRequests([]);
      }

    }catch(err){
      console.error(err);
      toast({
        title:"เกิดข้อผิดพลาด",
        variant:"destructive"
      });
      setRequests([]);
    }
    finally{
      setLoading(false);
    }
  };

  const getStatusBadge = (status:string)=>{
    const config = getStatusConfig(status);
    const Icon = config.icon;

    return(
      <Badge variant="outline" className={config.color}>
        <Icon className="h-3 w-3 mr-1"/>
        {config.label}
      </Badge>
    );
  };

  const filteredRequests = requests.filter((req)=>{

    const title = req.title?.toLowerCase() || "";

    const matchesSearch =
      title.includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || req.status === filterStatus;

    return matchesSearch && matchesStatus;

  });

  const stats = {
    total: requests.length,
    draft: requests.filter(r=>r.status==="draft").length,
    pending: requests.filter(r=>["submitted","zone_review_1","zone_review_2","admin_finalize"].includes(r.status)).length,
    approved: requests.filter(r=>["approved","competing","paid"].includes(r.status)).length,
    rejected: requests.filter(r=>r.status==="rejected").length,
    returned: requests.filter(r=>r.status==="returned").length
  };

  const EDIT_WINDOW_MS = 30*60*1000;

  const canEditOrDelete = (status:string,createdAt:string)=>{

    if(!["draft","returned","submitted"].includes(status))
      return false;

    const elapsed =
      Date.now() - new Date(createdAt).getTime();

    return elapsed <= EDIT_WINDOW_MS;

  };

  const handleDelete = async ()=>{

    if(!requestToDelete) return;

    try{

      setIsDeleting(true);

      const res = await apiPost({
        mode:"delete",
        id:requestToDelete.id
      });

      if(!res.success)
        throw new Error(res.error);

      toast({title:"ลบคำขอสำเร็จ"});

      fetchRequests();

    }catch(err){

      toast({
        title:"เกิดข้อผิดพลาด",
        variant:"destructive"
      });

    }
    finally{

      setDeleteDialogOpen(false);
      setRequestToDelete(null);
      setIsDeleting(false);

    }
  };

  const formatCurrency = (amount:number)=>
    new Intl.NumberFormat("th-TH",{
      style:"currency",
      currency:"THB",
      minimumFractionDigits:0
    }).format(Math.round(amount));

  const safeFormatDate = (dateStr:string)=>{
    try{
      const d = new Date(dateStr);
      if(isNaN(d.getTime())) return "-";
      return format(d,"d MMM yyyy HH:mm",{locale:th});
    }catch{
      return "-";
    }
  };

  return(
    <AppLayout>

      <section className="space-y-6">

        <header className="flex flex-col sm:flex-row sm:justify-between gap-3">

          <div>
            <h1 className="text-2xl font-bold flex gap-2 items-center">
              <FileText className="h-6 w-6"/>
              คำขอของฉัน
            </h1>

            <p className="text-muted-foreground">
              ดูและติดตามสถานะคำขอใช้งบประมาณของคุณ
            </p>
          </div>

          <div className="flex gap-2">

            <Button
              variant="outline"
              onClick={fetchRequests}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading?"animate-spin":""}`}/>
              รีเฟรช
            </Button>

            <Button asChild>
              <Link to="/create-request">
                <Plus className="h-4 w-4 mr-2"/>
                สร้างคำขอใหม่
              </Link>
            </Button>

          </div>

        </header>

        {/* stats */}

        <div className="grid gap-4 md:grid-cols-5">

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">ทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">แบบร่าง</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draft}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-info">
                ระหว่างดำเนินการ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">
                {stats.pending}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-success">
                อนุมัติแล้ว
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {stats.approved}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-destructive">
                ปฏิเสธ/ตีกลับ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {stats.rejected + stats.returned}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* table */}

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
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>

                {filteredRequests.map((request)=>(
                  <TableRow key={request.id}>

                    <TableCell>
                      {safeFormatDate(request.created_at)}
                    </TableCell>

                    <TableCell className="font-medium">
                      {request.title}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatCurrency(request.amount)}
                    </TableCell>

                    <TableCell>
                      {getStatusBadge(request.status)}
                    </TableCell>

                    <TableCell className="text-right">

                      <div className="flex justify-end gap-1">

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={()=>{
                            setSelectedRequest(request);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4"/>
                        </Button>

                        {canEditOrDelete(request.status,request.created_at)&&(

                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={()=>navigate(`/edit-request/${request.id}`)}
                            >
                              <Pencil className="h-4 w-4"/>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={()=>{
                                setRequestToDelete(request);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4"/>
                            </Button>
                          </>

                        )}

                      </div>

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
