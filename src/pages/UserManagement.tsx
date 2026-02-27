import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCheck, UserX, Search, Users, Clock, CheckCircle, XCircle, Edit } from 'lucide-react';
import { UserRole, UserStatus, getRoleLabel, getStatusLabel } from '@/lib/auth';
import { apiPost } from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  zone_id: string | null;
  status: UserStatus;
  affiliation: string | null;
  department: string | null;
  zone_name?: string;
}

export default function UserManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('pending');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('requester');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await apiPost({ mode: "users" });
    if (res.success && Array.isArray(res.data)) {
      setUsers(res.data);
    } else {
      setUsers([]);
    }
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, newStatus: UserStatus) => {
    if (actionLoading) return;
    setActionLoading(userId);
    try {
      const res = await apiPost({ mode: "update_user", id: userId, status: newStatus });
      if (res.success) {
        toast({ title: 'สำเร็จ', description: newStatus === 'approved' ? 'อนุมัติผู้ใช้เรียบร้อย' : 'ปฏิเสธผู้ใช้เรียบร้อย' });
        fetchUsers();
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const saveUserChanges = async () => {
    if (!editingUser || actionLoading) return;
    setActionLoading(editingUser.id);
    try {
      const res = await apiPost({ mode: "update_user", id: editingUser.id, role: editRole });
      if (res.success) {
        toast({ title: 'สำเร็จ' });
        setDialogOpen(false);
        fetchUsers();
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = selectedTab === 'all' || user.status === selectedTab;
    return matchesSearch && matchesTab;
  });

  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const approvedCount = users.filter((u) => u.status === 'approved').length;
  const rejectedCount = users.filter((u) => u.status === 'rejected').length;

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">{getStatusLabel(status)}</Badge>;
      case 'approved': return <Badge variant="outline" className="bg-success/10 text-success border-success/30">{getStatusLabel(status)}</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{getStatusLabel(status)}</Badge>;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Badge className="bg-primary">{getRoleLabel(role)}</Badge>;
      case 'zone_approver_1': return <Badge variant="secondary">{getRoleLabel(role)}</Badge>;
      case 'zone_approver_2': return <Badge variant="secondary">{getRoleLabel(role)}</Badge>;
      default: return <Badge variant="outline">{getRoleLabel(role)}</Badge>;
    }
  };

  if (profile?.role !== 'admin') {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการผู้ใช้งาน</h1>
          <p className="text-muted-foreground">อนุมัติผู้ใช้ใหม่และจัดการบทบาท</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">ผู้ใช้ทั้งหมด</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{users.length}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">รออนุมัติ</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold text-warning">{pendingCount}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">อนุมัติแล้ว</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold text-success">{approvedCount}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">ปฏิเสธ</CardTitle><XCircle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{rejectedCount}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>รายชื่อผู้ใช้งาน</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="ค้นหาชื่อหรืออีเมล..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="pending" className="gap-2"><Clock className="h-4 w-4" />รออนุมัติ ({pendingCount})</TabsTrigger>
                <TabsTrigger value="approved" className="gap-2"><CheckCircle className="h-4 w-4" />อนุมัติแล้ว ({approvedCount})</TabsTrigger>
                <TabsTrigger value="rejected" className="gap-2"><XCircle className="h-4 w-4" />ปฏิเสธ ({rejectedCount})</TabsTrigger>
                <TabsTrigger value="all">ทั้งหมด ({users.length})</TabsTrigger>
              </TabsList>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>บทบาท</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto" /></TableCell></TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลผู้ใช้</TableCell></TableRow>
                    ) : filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {user.status === 'pending' && (
                              <>
                                <Button size="sm" variant="outline" className="text-success hover:text-success hover:bg-success/10" disabled={actionLoading === user.id} onClick={() => updateUserStatus(user.id, 'approved')}><UserCheck className="h-4 w-4 mr-1" />{actionLoading === user.id ? '...' : 'อนุมัติ'}</Button>
                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={actionLoading === user.id} onClick={() => updateUserStatus(user.id, 'rejected')}><UserX className="h-4 w-4 mr-1" />{actionLoading === user.id ? '...' : 'ปฏิเสธ'}</Button>
                              </>
                            )}
                            {user.status === 'approved' && (
                              <Button size="sm" variant="outline" onClick={() => { setEditingUser(user); setEditRole(user.role); setDialogOpen(true); }}><Edit className="h-4 w-4 mr-1" />แก้ไข</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>แก้ไขผู้ใช้</DialogTitle><DialogDescription>{editingUser?.full_name} ({editingUser?.email})</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">บทบาท</label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requester">ผู้ขอใช้งบ</SelectItem>
                    <SelectItem value="zone_approver_1">ผู้อนุมัติ Level 1</SelectItem>
                    <SelectItem value="zone_approver_2">ผู้อนุมัติ Level 2</SelectItem>
                    <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={!!actionLoading}>ยกเลิก</Button>
              <Button onClick={saveUserChanges} className="gradient-primary" disabled={!!actionLoading}>{actionLoading ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
