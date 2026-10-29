"use client";

import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  BookOpen,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  UserCheck,
  RefreshCw,
  GraduationCap,
  History,
  ArrowUpRight,
  ShieldCheck,
  WalletCards,
  Check,
  Filter,
  Search,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type AcademicSession = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
};

type ClassItem = {
  id: string;
  name: string;
  sort_order: number;
};

type SectionItem = {
  id: string;
  class_id: string;
  name: string;
};

type StudentCount = {
  class_id: string | null;
  section_id: string | null;
};

type PromotionCandidate = {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string | null;
  father_name: string | null;
  class_id: string | null;
  section_id: string | null;
  status: string;
  pending_due: number;
  // Promotion decision state
  selected: boolean;
  action: "promoted" | "detained" | "graduated" | "reshuffled";
  target_section_id: string;
};

type AcademicHistoryRow = {
  id: string;
  student_id: string;
  from_session_name: string;
  to_session_name: string;
  from_class_name: string;
  from_section_name: string | null;
  to_class_name: string | null;
  to_section_name: string | null;
  action: string;
  previous_dues_carried: number;
  promoted_at: string;
  students?: {
    first_name: string;
    last_name: string | null;
    admission_no: string;
  } | null;
};

export default function AcademicsPage() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess, can, isAdmin } = useUserAccess([
    "settings.manage",
    "students.manage",
  ]);

  const [featureActive, setFeatureActive] = useState(true);
  const [activeTab, setActiveTab] = useState<"classes" | "sessions" | "promotion" | "history">("classes");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [students, setStudents] = useState<StudentCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal states for Class
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [className, setClassName] = useState("");
  const [classSortOrder, setClassSortOrder] = useState(0);

  // Modal states for Section
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [targetClassForSection, setTargetClassForSection] = useState<ClassItem | null>(null);
  const [sectionName, setSectionName] = useState("");

  // Modal states for Session
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [sessionForm, setSessionForm] = useState({
    name: "",
    starts_on: "",
    ends_on: "",
    is_current: false,
  });

  // -------------------------------------------------------------------------
  // Promotion & Reshuffle Wizard State
  // -------------------------------------------------------------------------
  const [fromSessionId, setFromSessionId] = useState<string>("");
  const [toSessionId, setToSessionId] = useState<string>("");
  const [sourceClassId, setSourceClassId] = useState<string>("");
  const [sourceSectionId, setSourceSectionId] = useState<string>("all");
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [defaultTargetSectionId, setDefaultTargetSectionId] = useState<string>("");
  const [promotionMode, setPromotionMode] = useState<"promote" | "reshuffle" | "graduate">("promote");
  const [carryForwardDues, setCarryForwardDues] = useState<boolean>(true);

  const [promotionCandidates, setPromotionCandidates] = useState<PromotionCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Promotion History Logs State
  const [historyLogs, setHistoryLogs] = useState<AcademicHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const canManage = can("settings.manage") || can("students.manage");

  // Load classes, sections, sessions, and students counts
  const loadData = async () => {
    if (!orgId) return;
    const feat = await fetchInstitutionFeatures(supabase, orgId);
    if (feat && feat.academics === false) {
      setFeatureActive(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");

      const [clsRes, secRes, sesRes, stuRes] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name, sort_order")
          .eq("organization_id", orgId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("sections")
          .select("id, class_id, name")
          .eq("organization_id", orgId)
          .order("name", { ascending: true }),
        supabase
          .from("academic_sessions")
          .select("id, name, starts_on, ends_on, is_current")
          .eq("organization_id", orgId)
          .order("starts_on", { ascending: false }),
        supabase
          .from("students")
          .select("class_id, section_id")
          .eq("organization_id", orgId)
          .eq("status", "active"),
      ]);

      if (clsRes.error) throw clsRes.error;
      if (secRes.error) throw secRes.error;
      if (sesRes.error) throw sesRes.error;

      const clsList = clsRes.data || [];
      const sesList = sesRes.data || [];

      setClasses(clsList);
      setSections(secRes.data || []);
      setSessions(sesList);
      setStudents(stuRes.data || []);

      // Pre-select active sessions for promotion wizard
      const currentSes = sesList.find((s) => s.is_current);
      if (currentSes) {
        setFromSessionId(currentSes.id);
        const otherSes = sesList.find((s) => s.id !== currentSes.id);
        if (otherSes) setToSessionId(otherSes.id);
      } else if (sesList.length > 0) {
        setFromSessionId(sesList[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load academic data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  // Compute student counts per class and per section
  const studentCountByClass = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of students) {
      if (s.class_id) {
        counts[s.class_id] = (counts[s.class_id] || 0) + 1;
      }
    }
    return counts;
  }, [students]);

  const studentCountBySection = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of students) {
      if (s.section_id) {
        counts[s.section_id] = (counts[s.section_id] || 0) + 1;
      }
    }
    return counts;
  }, [students]);

  // Active session
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.is_current);
  }, [sessions]);

  // Next class auto-suggestion based on sort_order
  useEffect(() => {
    if (!sourceClassId) return;

    if (promotionMode === "graduate") {
      setTargetClassId("");
      setDefaultTargetSectionId("");
      return;
    }

    if (promotionMode === "reshuffle") {
      setTargetClassId(sourceClassId);
      return;
    }

    // Default: promote to next class
    const sourceIdx = classes.findIndex((c) => c.id === sourceClassId);
    if (sourceIdx !== -1 && sourceIdx < classes.length - 1) {
      const nextClass = classes[sourceIdx + 1];
      setTargetClassId(nextClass.id);
    } else {
      setTargetClassId("");
    }
  }, [sourceClassId, promotionMode, classes]);

  // Available sections for target class
  const targetClassSections = useMemo(() => {
    if (!targetClassId) return [];
    return sections.filter((s) => s.class_id === targetClassId);
  }, [targetClassId, sections]);

  // Update default target section when target class changes
  useEffect(() => {
    if (targetClassSections.length > 0) {
      setDefaultTargetSectionId(targetClassSections[0].id);
    } else {
      setDefaultTargetSectionId("");
    }
  }, [targetClassSections]);

  // -------------------------------------------------------------------------
  // Load Candidates when Source Class / Section Changes
  // -------------------------------------------------------------------------
  const loadPromotionCandidates = async () => {
    if (!sourceClassId || !orgId) {
      setPromotionCandidates([]);
      return;
    }

    try {
      setLoadingCandidates(true);
      setError("");

      let query = supabase
        .from("students")
        .select("id, admission_no, first_name, last_name, father_name, class_id, section_id, status")
        .eq("organization_id", orgId)
        .eq("class_id", sourceClassId)
        .eq("status", "active")
        .order("first_name", { ascending: true });

      if (sourceSectionId && sourceSectionId !== "all") {
        query = query.eq("section_id", sourceSectionId);
      }

      const { data: stData, error: stErr } = await query;
      if (stErr) throw stErr;

      const studentIds = (stData || []).map((s) => s.id);

      // Fetch pending fee dues for these students
      const duesMap: Record<string, number> = {};
      if (studentIds.length > 0) {
        const { data: feeData } = await supabase
          .from("student_fee_months")
          .select("student_id, amount_due, amount_paid, status")
          .eq("organization_id", orgId)
          .in("student_id", studentIds)
          .neq("status", "paid");

        for (const f of feeData || []) {
          const due = Math.max(0, Number(f.amount_due || 0) - Number(f.amount_paid || 0));
          duesMap[f.student_id] = (duesMap[f.student_id] || 0) + due;
        }
      }

      const initialDefaultAction: "promoted" | "detained" | "graduated" | "reshuffled" =
        promotionMode === "graduate"
          ? "graduated"
          : promotionMode === "reshuffle"
          ? "reshuffled"
          : "promoted";

      const candidates: PromotionCandidate[] = (stData || []).map((st) => ({
        id: st.id,
        admission_no: st.admission_no,
        first_name: st.first_name,
        last_name: st.last_name,
        father_name: st.father_name,
        class_id: st.class_id,
        section_id: st.section_id,
        status: st.status,
        pending_due: duesMap[st.id] || 0,
        selected: true,
        action: initialDefaultAction,
        target_section_id: defaultTargetSectionId,
      }));

      setPromotionCandidates(candidates);
    } catch (err: any) {
      setError(err.message || "Failed to load students for promotion.");
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    if (activeTab === "promotion" && sourceClassId) {
      loadPromotionCandidates();
    }
  }, [sourceClassId, sourceSectionId, promotionMode, activeTab]);

  // Update candidates' default action & target section if global defaults change
  useEffect(() => {
    if (promotionCandidates.length === 0) return;

    const action =
      promotionMode === "graduate"
        ? "graduated"
        : promotionMode === "reshuffle"
        ? "reshuffled"
        : "promoted";

    setPromotionCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        action,
        target_section_id: defaultTargetSectionId,
      }))
    );
  }, [promotionMode, defaultTargetSectionId]);

  // -------------------------------------------------------------------------
  // Load Archival History Logs
  // -------------------------------------------------------------------------
  const loadHistoryLogs = async () => {
    if (!orgId) return;
    try {
      setLoadingHistory(true);
      const { data, error: hErr } = await supabase
        .from("student_academic_history")
        .select(`
          id, student_id, from_session_name, to_session_name,
          from_class_name, from_section_name, to_class_name, to_section_name,
          action, previous_dues_carried, promoted_at,
          students(first_name, last_name, admission_no)
        `)
        .eq("organization_id", orgId)
        .order("promoted_at", { ascending: false })
        .limit(200);

      if (hErr) throw hErr;
      setHistoryLogs((data as any) || []);
    } catch (err: any) {
      console.warn("Could not load history logs:", err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistoryLogs();
    }
  }, [activeTab, orgId]);

  // -------------------------------------------------------------------------
  // Execute Batch Promotion Handler
  // -------------------------------------------------------------------------
  const handleExecutePromotion = async () => {
    const selectedList = promotionCandidates.filter((c) => c.selected);
    if (selectedList.length === 0) {
      setError("Please select at least one student to promote.");
      return;
    }

    if (promotionMode !== "graduate" && !targetClassId) {
      setError("Please choose a target class to promote students into.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    const fromSesObj = sessions.find((s) => s.id === fromSessionId);
    const toSesObj = sessions.find((s) => s.id === toSessionId);
    const fromClsObj = classes.find((c) => c.id === sourceClassId);
    const toClsObj = classes.find((c) => c.id === targetClassId);

    const fromSessionName = fromSesObj?.name || "Current Session";
    const toSessionName = toSesObj?.name || fromSessionName;
    const fromClassName = fromClsObj?.name || "Class";
    const toClassName = promotionMode === "graduate" ? "Alumni" : toClsObj?.name || fromClassName;

    // Build payload array for atomic promotion
    const payload = selectedList.map((c) => {
      const fromSecObj = sections.find((s) => s.id === c.section_id);
      const toSecObj = sections.find((s) => s.id === c.target_section_id);

      return {
        student_id: c.id,
        from_session_id: fromSessionId || null,
        from_session_name: fromSessionName,
        to_session_id: toSessionId || null,
        to_session_name: toSessionName,
        from_class_id: sourceClassId,
        from_class_name: fromClassName,
        from_section_id: c.section_id || null,
        from_section_name: fromSecObj?.name || null,
        to_class_id: c.action === "graduated" ? null : c.action === "detained" ? sourceClassId : targetClassId,
        to_class_name: c.action === "graduated" ? "Alumni" : c.action === "detained" ? fromClassName : toClassName,
        to_section_id: c.action === "graduated" ? null : c.target_section_id || null,
        to_section_name: toSecObj?.name || null,
        action: c.action,
        previous_due: c.pending_due || 0,
        carry_forward_dues: carryForwardDues,
        remarks: `Promoted from ${fromClassName} to ${toClassName} for session ${toSessionName}`,
      };
    });

    try {
      // 1. Try RPC execution first
      let rpcSucceeded = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("promote_students_batch", {
          p_items: payload,
        });
        if (!rpcErr && rpcRes?.success) {
          rpcSucceeded = true;
        }
      } catch {}

      // 2. Client-side fallback if RPC not yet created
      if (!rpcSucceeded) {
        for (const item of payload) {
          // Update student
          if (item.action === "graduated") {
            await supabase
              .from("students")
              .update({ status: "alumni" })
              .eq("id", item.student_id)
              .eq("organization_id", orgId);
          } else {
            await supabase
              .from("students")
              .update({
                class_id: item.to_class_id,
                section_id: item.to_section_id,
                status: "active",
              })
              .eq("id", item.student_id)
              .eq("organization_id", orgId);
          }

          // Insert history
          try {
            await supabase.from("student_academic_history").insert({
              organization_id: orgId,
              student_id: item.student_id,
              from_session_id: item.from_session_id,
              from_session_name: item.from_session_name,
              to_session_id: item.to_session_id,
              to_session_name: item.to_session_name,
              from_class_id: item.from_class_id,
              from_class_name: item.from_class_name,
              from_section_id: item.from_section_id,
              from_section_name: item.from_section_name,
              to_class_id: item.to_class_id,
              to_class_name: item.to_class_name,
              to_section_id: item.to_section_id,
              to_section_name: item.to_section_name,
              action: item.action,
              previous_dues_carried: item.previous_due,
              remarks: item.remarks,
            });
          } catch {}

          // Carry forward dues if toggled
          if (carryForwardDues && item.previous_due > 0) {
            const currentMonthDate = new Date().toISOString().slice(0, 7) + "-01";
            try {
              await supabase.from("student_fee_months").upsert(
                {
                  organization_id: orgId,
                  student_id: item.student_id,
                  fee_month: currentMonthDate,
                  amount_due: item.previous_due,
                  amount_paid: 0,
                  status: "unpaid",
                },
                { onConflict: "student_id,fee_month" }
              );
            } catch {}
          }
        }
      }

      setConfirmModalOpen(false);
      setSuccess(
        `Successfully processed ${selectedList.length} students from ${fromClassName}! Class updated & historical logs archived.`
      );

      // Refresh data
      await loadData();
      await loadPromotionCandidates();
    } catch (err: any) {
      setError(err.message || "Failed to process student promotions.");
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Existing Handlers (Classes, Sections, Sessions)
  // -------------------------------------------------------------------------
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (editingClass) {
        const { error: err } = await supabase
          .from("classes")
          .update({
            name: className.trim(),
            sort_order: Number(classSortOrder) || 0,
          })
          .eq("id", editingClass.id)
          .eq("organization_id", orgId);
        if (err) throw err;
        setSuccess(`Class "${className.trim()}" updated successfully.`);
      } else {
        const { error: err } = await supabase.from("classes").insert({
          organization_id: orgId,
          name: className.trim(),
          sort_order: Number(classSortOrder) || 0,
        });
        if (err) throw err;
        setSuccess(`Class "${className.trim()}" created successfully.`);
      }

      setClassModalOpen(false);
      setEditingClass(null);
      setClassName("");
      setClassSortOrder(0);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Could not save class.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClass = async (cls: ClassItem) => {
    const count = studentCountByClass[cls.id] || 0;
    if (count > 0) {
      setError(
        `Cannot delete class "${cls.name}" because ${count} student(s) are currently enrolled in it. Promote or reassign them first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete class "${cls.name}"? This will also remove its sections.`)) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { error: err } = await supabase
        .from("classes")
        .delete()
        .eq("id", cls.id)
        .eq("organization_id", orgId);
      if (err) throw err;
      setSuccess(`Class "${cls.name}" deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete class.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClassForSection || !sectionName.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const { error: err } = await supabase.from("sections").insert({
        organization_id: orgId,
        class_id: targetClassForSection.id,
        name: sectionName.trim(),
      });
      if (err) throw err;
      setSuccess(`Section "${sectionName.trim()}" added to ${targetClassForSection.name}.`);
      setSectionModalOpen(false);
      setTargetClassForSection(null);
      setSectionName("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Could not add section.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSection = async (sec: SectionItem) => {
    const count = studentCountBySection[sec.id] || 0;
    if (count > 0) {
      setError(`Cannot delete section "${sec.name}" because ${count} student(s) are assigned to it.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete section "${sec.name}"?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { error: err } = await supabase
        .from("sections")
        .delete()
        .eq("id", sec.id)
        .eq("organization_id", orgId);
      if (err) throw err;
      setSuccess(`Section "${sec.name}" deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete section.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.name.trim() || !sessionForm.starts_on || !sessionForm.ends_on) {
      setError("Please fill in session name, start date, and end date.");
      return;
    }

    if (sessionForm.starts_on >= sessionForm.ends_on) {
      setError("Session start date must be before end date.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (sessionForm.is_current) {
        await supabase
          .from("academic_sessions")
          .update({ is_current: false })
          .eq("organization_id", orgId);
      }

      if (editingSession) {
        const { error: err } = await supabase
          .from("academic_sessions")
          .update({
            name: sessionForm.name.trim(),
            starts_on: sessionForm.starts_on,
            ends_on: sessionForm.ends_on,
            is_current: sessionForm.is_current,
          })
          .eq("id", editingSession.id)
          .eq("organization_id", orgId);
        if (err) throw err;
        setSuccess(`Academic session "${sessionForm.name}" updated.`);
      } else {
        const { error: err } = await supabase.from("academic_sessions").insert({
          organization_id: orgId,
          name: sessionForm.name.trim(),
          starts_on: sessionForm.starts_on,
          ends_on: sessionForm.ends_on,
          is_current: sessionForm.is_current,
        });
        if (err) throw err;
        setSuccess(`Academic session "${sessionForm.name}" created.`);
      }

      setSessionModalOpen(false);
      setEditingSession(null);
      setSessionForm({ name: "", starts_on: "", ends_on: "", is_current: false });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Could not save academic session.");
    } finally {
      setBusy(false);
    }
  };

  const handleSetCurrentSession = async (ses: AcademicSession) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await supabase
        .from("academic_sessions")
        .update({ is_current: false })
        .eq("organization_id", orgId);

      const { error: err } = await supabase
        .from("academic_sessions")
        .update({ is_current: true })
        .eq("id", ses.id)
        .eq("organization_id", orgId);

      if (err) throw err;
      setSuccess(`"${ses.name}" is now the active academic session.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to set active session.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSession = async (ses: AcademicSession) => {
    if (ses.is_current) {
      setError("Cannot delete the active academic session. Set another session as current first.");
      return;
    }

    if (!confirm(`Are you sure you want to delete session "${ses.name}"?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { error: err } = await supabase
        .from("academic_sessions")
        .delete()
        .eq("id", ses.id)
        .eq("organization_id", orgId);
      if (err) throw err;
      setSuccess(`Session "${ses.name}" deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete session.");
    } finally {
      setBusy(false);
    }
  };

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return promotionCandidates.filter((c) => {
      const fullName = `${c.first_name} ${c.last_name || ""}`.toLowerCase();
      const adm = c.admission_no.toLowerCase();
      const q = candidateSearch.toLowerCase();
      return fullName.includes(q) || adm.includes(q);
    });
  }, [promotionCandidates, candidateSearch]);

  const selectedCandidatesCount = useMemo(() => {
    return promotionCandidates.filter((c) => c.selected).length;
  }, [promotionCandidates]);

  const totalCarriedDues = useMemo(() => {
    return promotionCandidates
      .filter((c) => c.selected)
      .reduce((sum, c) => sum + (c.pending_due || 0), 0);
  }, [promotionCandidates]);

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Checking permissions...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Academic Structure" />;
  }

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <FeatureGate featureKey="academics" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f8fafc] text-slate-800">
      {/* Soft Ambient Background Mesh */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[380px] w-[380px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-32 left-1/2 h-[400px] w-[400px] rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl p-5 sm:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs backdrop-blur hover:bg-slate-50"
            >
              <ArrowLeft size={15} /> Dashboard
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Academic Management & Promotions
                </span>
                {activeSession && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 shadow-2xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active: {activeSession.name}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Classes, Sessions & Promotions
              </h1>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              {activeTab === "classes" && (
                <button
                  onClick={() => {
                    setEditingClass(null);
                    setClassName("");
                    setClassSortOrder(classes.length + 1);
                    setClassModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
                >
                  <Plus size={15} /> Add Class
                </button>
              )}
              {activeTab === "sessions" && (
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setSessionForm({
                      name: "",
                      starts_on: "",
                      ends_on: "",
                      is_current: sessions.length === 0,
                    });
                    setSessionModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
                >
                  <Plus size={15} /> Add Session
                </button>
              )}
              {activeTab === "promotion" && (
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setSessionForm({
                      name: "",
                      starts_on: "",
                      ends_on: "",
                      is_current: false,
                    });
                    setSessionModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                >
                  <Calendar size={14} className="text-indigo-600" />
                  + Create New Session
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation Bar */}
        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/85 p-1.5 shadow-xs backdrop-blur-xl">
          <button
            onClick={() => setActiveTab("classes")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "classes"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Layers size={15} />
            Classes & Sections ({classes.length})
          </button>

          <button
            onClick={() => setActiveTab("sessions")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "sessions"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Calendar size={15} />
            Academic Sessions ({sessions.length})
          </button>

          <button
            onClick={() => setActiveTab("promotion")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "promotion"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-indigo-600 hover:bg-indigo-50"
            }`}
          >
            <Sparkles size={15} />
            Promotion & Reshuffle Wizard
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "history"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <History size={15} />
            Promotion History Logs
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: Classes & Sections */}
        {/* ========================================================================= */}
        {activeTab === "classes" && (
          <div className="space-y-4">
            {loading ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-12 text-center text-xs text-slate-500">
                Loading classes and sections...
              </div>
            ) : classes.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-12 text-center">
                <Layers size={36} className="mx-auto text-slate-300" />
                <h3 className="mt-3 text-base font-bold text-slate-900">No classes configured</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Create classes (e.g. Nursery, Class 1, Class 10, Hifz) so you can organize students and mark attendance.
                </p>
                {canManage && (
                  <button
                    onClick={() => {
                      setEditingClass(null);
                      setClassName("");
                      setClassSortOrder(1);
                      setClassModalOpen(true);
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                  >
                    <Plus size={15} /> Add First Class
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => {
                  const classSections = sections.filter((s) => s.class_id === cls.id);
                  const count = studentCountByClass[cls.id] || 0;

                  return (
                    <div
                      key={cls.id}
                      className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl transition hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-base font-bold text-slate-900">{cls.name}</h3>
                            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              <Users size={12} />
                              {count} {count === 1 ? "student" : "students"}
                            </span>
                          </div>

                          {canManage && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingClass(cls);
                                  setClassName(cls.name);
                                  setClassSortOrder(cls.sort_order);
                                  setClassModalOpen(true);
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                title="Edit Class"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteClass(cls)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                title="Delete Class"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Sections List */}
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            <span>Sections</span>
                            {canManage && (
                              <button
                                onClick={() => {
                                  setTargetClassForSection(cls);
                                  setSectionName("");
                                  setSectionModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                              >
                                <Plus size={12} /> Add Section
                              </button>
                            )}
                          </div>

                          {classSections.length === 0 ? (
                            <p className="text-xs italic text-slate-400">No sections added yet (e.g. A, B)</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {classSections.map((sec) => {
                                const secCount = studentCountBySection[sec.id] || 0;
                                return (
                                  <span
                                    key={sec.id}
                                    className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700"
                                  >
                                    <span>
                                      Sec {sec.name}{" "}
                                      <span className="text-[10px] text-slate-400 font-normal">({secCount})</span>
                                    </span>
                                    {canManage && (
                                      <button
                                        onClick={() => handleDeleteSection(sec)}
                                        className="text-slate-300 opacity-60 transition hover:text-red-600 group-hover:opacity-100"
                                        title="Delete section"
                                      >
                                        <X size={11} />
                                      </button>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-2 text-[10px] font-mono text-slate-400">
                        Order priority: {cls.sort_order}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: Academic Sessions */}
        {/* ========================================================================= */}
        {activeTab === "sessions" && (
          <div className="space-y-4">
            {loading ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-12 text-center text-xs text-slate-500">
                Loading academic sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-12 text-center">
                <Calendar size={36} className="mx-auto text-slate-300" />
                <h3 className="mt-3 text-base font-bold text-slate-900">No academic sessions</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Create your active academic year (e.g. 2025-2026) to manage admissions and exam periods.
                </p>
                {canManage && (
                  <button
                    onClick={() => {
                      setEditingSession(null);
                      setSessionForm({
                        name: "",
                        starts_on: "",
                        ends_on: "",
                        is_current: true,
                      });
                      setSessionModalOpen(true);
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                  >
                    <Plus size={15} /> Add First Session
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-xl">
                <div className="border-b border-slate-100 p-5">
                  <h2 className="font-bold text-slate-900">Academic Years & Cycles</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Active session controls default admission year, exam datesheets, and fee invoices.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5">Session Name</th>
                        <th className="px-5 py-3.5">Starts On</th>
                        <th className="px-5 py-3.5">Ends On</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessions.map((ses) => (
                        <tr key={ses.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-4 font-bold text-slate-900">{ses.name}</td>
                          <td className="px-5 py-4 text-slate-600">{ses.starts_on}</td>
                          <td className="px-5 py-4 text-slate-600">{ses.ends_on}</td>
                          <td className="px-5 py-4">
                            {ses.is_current ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Current Active
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                                Inactive / Archive
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {canManage && !ses.is_current && (
                                <button
                                  onClick={() => handleSetCurrentSession(ses)}
                                  disabled={busy}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                                >
                                  Set as Current
                                </button>
                              )}
                              {canManage && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingSession(ses);
                                      setSessionForm({
                                        name: ses.name,
                                        starts_on: ses.starts_on,
                                        ends_on: ses.ends_on,
                                        is_current: ses.is_current,
                                      });
                                      setSessionModalOpen(true);
                                    }}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    title="Edit"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSession(ses)}
                                    disabled={ses.is_current || busy}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                                    title={ses.is_current ? "Cannot delete active session" : "Delete"}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROMOTION & RESHUFFLE WIZARD */}
        {/* ========================================================================= */}
        {activeTab === "promotion" && (
          <div className="space-y-6">
            {/* Top Control Panel */}
            <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white/95 via-indigo-50/20 to-violet-50/30 p-6 shadow-xs backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Batch Student Promotion & Reshuffle Wizard</h2>
                  <p className="text-xs text-slate-500">
                    Safely upgrade students to their next academic class, reshuffle sections, or graduate alumni batches.
                  </p>
                </div>
              </div>

              {/* Configuration Grid */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. From Session */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Source Session (From)
                  </label>
                  <select
                    value={fromSessionId}
                    onChange={(e) => setFromSessionId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.is_current ? "(Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. To Session */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Target Session (To)
                  </label>
                  <select
                    value={toSessionId}
                    onChange={(e) => setToSessionId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.is_current ? "(Active)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Source Class */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Source Class (Promoting From) *
                  </label>
                  <select
                    value={sourceClassId}
                    onChange={(e) => setSourceClassId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="">-- Select Class --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({studentCountByClass[c.id] || 0} students)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Source Section Filter */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Source Section
                  </label>
                  <select
                    value={sourceSectionId}
                    onChange={(e) => setSourceSectionId(e.target.value)}
                    disabled={!sourceClassId}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden disabled:opacity-50"
                  >
                    <option value="all">All Sections</option>
                    {sections
                      .filter((s) => s.class_id === sourceClassId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          Section {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Mode & Target Class Bar */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Promotion Mode Radio Pills */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Promotion Action Mode
                    </label>
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPromotionMode("promote")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          promotionMode === "promote"
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Next Class
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromotionMode("reshuffle")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          promotionMode === "reshuffle"
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Reshuffle
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromotionMode("graduate")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          promotionMode === "graduate"
                            ? "bg-purple-600 text-white shadow-2xs"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Graduate / Alumni
                      </button>
                    </div>
                  </div>

                  {/* Target Class */}
                  {promotionMode !== "graduate" && (
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Target Class (Promote Into) *
                      </label>
                      <select
                        value={targetClassId}
                        onChange={(e) => setTargetClassId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 focus:border-indigo-500 focus:outline-hidden"
                      >
                        <option value="">-- Select Target Class --</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Target Default Section */}
                  {promotionMode !== "graduate" && (
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Target Default Section
                      </label>
                      <select
                        value={defaultTargetSectionId}
                        onChange={(e) => setDefaultTargetSectionId(e.target.value)}
                        disabled={targetClassSections.length === 0}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden disabled:opacity-50"
                      >
                        <option value="">-- No Section Assigned --</option>
                        {targetClassSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            Section {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Carry Forward Dues Checkbox */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={carryForwardDues}
                      onChange={(e) => setCarryForwardDues(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Carry forward unpaid fee balance into the new academic session ledger
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Unpaid dues will be transferred automatically
                  </span>
                </div>
              </div>
            </div>

            {/* Candidates Roster */}
            {!sourceClassId ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-12 text-center">
                <Users size={32} className="mx-auto text-slate-300" />
                <h3 className="mt-2 text-sm font-bold text-slate-800">Select a Source Class to Begin</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Choose which class you want to promote (e.g. Class 1) using the dropdown above.
                </p>
              </div>
            ) : loadingCandidates ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-12 text-center text-xs text-slate-500">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                Loading students roster and calculating fee dues...
              </div>
            ) : promotionCandidates.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-10 text-center">
                <p className="text-xs font-semibold text-slate-500">
                  No active students found in this class/section.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-xl">
                {/* Roster Header & Search */}
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={
                          promotionCandidates.length > 0 &&
                          promotionCandidates.every((c) => c.selected)
                        }
                        onChange={(e) => {
                          const val = e.target.checked;
                          setPromotionCandidates((prev) => prev.map((c) => ({ ...c, selected: val })));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Select All ({promotionCandidates.length} students)</span>
                    </label>

                    <span className="text-xs font-bold text-indigo-700">
                      • {selectedCandidatesCount} selected for promotion
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter students..."
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
                      <tr>
                        <th className="w-10 px-4 py-3"></th>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Admission No</th>
                        <th className="px-4 py-3">Action Mode</th>
                        {promotionMode !== "graduate" && <th className="px-4 py-3">Target Section</th>}
                        <th className="px-4 py-3">Pending Fee Dues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCandidates.map((c) => (
                        <tr
                          key={c.id}
                          className={`transition ${c.selected ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/50 opacity-60"}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={c.selected}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setPromotionCandidates((prev) =>
                                  prev.map((item) => (item.id === c.id ? { ...item, selected: val } : item))
                                );
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>

                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div>
                              <span>
                                {c.first_name} {c.last_name || ""}
                              </span>
                              {c.father_name && (
                                <span className="block text-[10px] font-normal text-slate-400">
                                  S/O {c.father_name}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-slate-600">{c.admission_no}</td>

                          {/* Action Selector */}
                          <td className="px-4 py-3">
                            <select
                              value={c.action}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setPromotionCandidates((prev) =>
                                  prev.map((item) => (item.id === c.id ? { ...item, action: val } : item))
                                );
                              }}
                              className={`rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-hidden ${
                                c.action === "promoted"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : c.action === "detained"
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-purple-200 bg-purple-50 text-purple-800"
                              }`}
                            >
                              <option value="promoted">Promote</option>
                              <option value="detained">Detain (Repeat)</option>
                              <option value="graduated">Graduate (Alumni)</option>
                            </select>
                          </td>

                          {/* Individual Target Section Override */}
                          {promotionMode !== "graduate" && (
                            <td className="px-4 py-3">
                              <select
                                value={c.target_section_id}
                                disabled={c.action === "graduated"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPromotionCandidates((prev) =>
                                    prev.map((item) =>
                                      item.id === c.id ? { ...item, target_section_id: val } : item
                                    )
                                  );
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:outline-hidden disabled:opacity-40"
                              >
                                <option value="">Default</option>
                                {targetClassSections.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    Section {s.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}

                          {/* Fee Dues */}
                          <td className="px-4 py-3">
                            {c.pending_due > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                ₹{c.pending_due.toLocaleString("en-IN")} Due
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                <Check size={12} /> Clear
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Execution Bar */}
                <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-600">
                    <span className="font-bold text-slate-900">{selectedCandidatesCount} students</span> ready for{" "}
                    <strong>{promotionMode === "graduate" ? "Graduation" : "Promotion"}</strong>. Total carried dues:{" "}
                    <strong className="text-amber-700">₹{totalCarriedDues.toLocaleString("en-IN")}</strong>
                  </div>

                  <button
                    disabled={selectedCandidatesCount === 0 || busy}
                    onClick={() => setConfirmModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    <ArrowRight size={14} /> Proceed with Promotion ({selectedCandidatesCount})
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation Modal */}
            {confirmModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
                <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Sparkles size={18} />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">Confirm Class Promotion</h3>
                    </div>
                    <button
                      onClick={() => setConfirmModalOpen(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 text-xs text-slate-600">
                    <p>You are about to execute the following academic transition:</p>

                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Source Class:</span>
                        <strong className="text-slate-900">
                          {classes.find((c) => c.id === sourceClassId)?.name}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Target Action:</span>
                        <strong className="text-indigo-700 uppercase">{promotionMode}</strong>
                      </div>
                      {promotionMode !== "graduate" && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Target Class:</span>
                          <strong className="text-slate-900">
                            {classes.find((c) => c.id === targetClassId)?.name}
                          </strong>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-indigo-100/80 pt-2">
                        <span className="text-slate-500">Total Students Selected:</span>
                        <strong className="text-slate-900">{selectedCandidatesCount}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Carry Forward Dues:</span>
                        <strong className="text-amber-700">
                          {carryForwardDues ? `Yes (₹${totalCarriedDues.toLocaleString("en-IN")})` : "No"}
                        </strong>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                      <AlertTriangle size={14} className="inline mr-1 text-amber-600" />
                      Student records, attendance, and exam marks from the current session remain permanently preserved in historical archives.
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setConfirmModalOpen(false)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleExecutePromotion}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                    >
                      {busy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      {busy ? "Processing Promotion..." : "Confirm & Execute Promotion"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PROMOTION HISTORY & ARCHIVAL LOGS */}
        {/* ========================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">Student Academic Promotion History</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Audit log of all student promotions, section reshuffles, and carried fee balances.
                  </p>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search history by name..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {loadingHistory ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  Loading promotion history records...
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="p-12 text-center">
                  <History size={36} className="mx-auto text-slate-300" />
                  <h3 className="mt-2 text-sm font-bold text-slate-800">No promotion history recorded yet</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    When you promote students using the Promotion Wizard, the audit trail will be saved here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5">Date</th>
                        <th className="px-5 py-3.5">Student</th>
                        <th className="px-5 py-3.5">Admission No</th>
                        <th className="px-5 py-3.5">Session Transition</th>
                        <th className="px-5 py-3.5">Class Transition</th>
                        <th className="px-5 py-3.5">Action</th>
                        <th className="px-5 py-3.5">Carried Dues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyLogs
                        .filter((h) => {
                          const name = `${h.students?.first_name || ""} ${h.students?.last_name || ""}`.toLowerCase();
                          return name.includes(historySearch.toLowerCase());
                        })
                        .map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-4 text-slate-500">
                              {new Date(h.promoted_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>

                            <td className="px-5 py-4 font-bold text-slate-900">
                              {h.students?.first_name} {h.students?.last_name || ""}
                            </td>

                            <td className="px-5 py-4 font-mono text-slate-600">
                              {h.students?.admission_no || "—"}
                            </td>

                            <td className="px-5 py-4 text-slate-600">
                              <span className="font-semibold">{h.from_session_name}</span> ➔{" "}
                              <span className="font-semibold text-slate-900">{h.to_session_name}</span>
                            </td>

                            <td className="px-5 py-4 text-slate-700 font-semibold">
                              {h.from_class_name} {h.from_section_name ? `(${h.from_section_name})` : ""}{" "}
                              ➔ {h.to_class_name || "Alumni"} {h.to_section_name ? `(${h.to_section_name})` : ""}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
                                  h.action === "promoted"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : h.action === "detained"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-purple-50 text-purple-700 border border-purple-200"
                                }`}
                              >
                                {h.action}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              {h.previous_dues_carried > 0 ? (
                                <span className="font-bold text-amber-700">
                                  ₹{Number(h.previous_dues_carried).toLocaleString("en-IN")}
                                </span>
                              ) : (
                                <span className="text-slate-400">₹0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- Modals ---------------- */}
        {/* Class Modal */}
        {classModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  {editingClass ? "Edit Class" : "Add New Class"}
                </h2>
                <button
                  onClick={() => setClassModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveClass} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Class 1, Class 10, Nursery, Hifz"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Sort Order (Rank Priority)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={classSortOrder}
                    onChange={(e) => setClassSortOrder(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Lower numbers appear first in lists and promotion hierarchy.
                  </p>
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setClassModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? "Saving..." : editingClass ? "Update Class" : "Create Class"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Section Modal */}
        {sectionModalOpen && targetClassForSection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  Add Section to {targetClassForSection.name}
                </h2>
                <button
                  onClick={() => setSectionModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveSection} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Section Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A, B, Boys, Girls, Morning"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setSectionModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? "Adding..." : "Add Section"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Session Modal */}
        {sessionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  {editingSession ? "Edit Academic Session" : "Add Academic Session"}
                </h2>
                <button
                  onClick={() => setSessionModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveSession} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Session Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2025-2026 or 1446-1447 H"
                    value={sessionForm.name}
                    onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Starts On *
                    </label>
                    <input
                      type="date"
                      required
                      value={sessionForm.starts_on}
                      onChange={(e) => setSessionForm({ ...sessionForm, starts_on: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Ends On *
                    </label>
                    <input
                      type="date"
                      required
                      value={sessionForm.ends_on}
                      onChange={(e) => setSessionForm({ ...sessionForm, ends_on: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    checked={sessionForm.is_current}
                    onChange={(e) => setSessionForm({ ...sessionForm, is_current: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Set as current active session
                  </span>
                </label>

                <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setSessionModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? "Saving..." : editingSession ? "Update Session" : "Create Session"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
