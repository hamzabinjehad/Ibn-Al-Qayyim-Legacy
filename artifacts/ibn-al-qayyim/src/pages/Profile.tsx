import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import { getSessionId } from "@/lib/session";
import {
  Highlighter,
  StickyNote,
  MessageSquare,
  BookOpen,
  ChevronLeft,
  Moon,
  Sun,
  Trash2,
} from "lucide-react";
import { customFetch } from "@/lib/api/custom-fetch";

type Tab = "gallery" | "notes" | "comments";

interface ProfileHighlight {
  id: number;
  chapterId: number;
  selectedText: string;
  color: string;
  createdAt: string;
  chapterTitleAr: string;
  bookId: number;
  bookTitleAr: string;
}

interface ProfileNote {
  id: number;
  chapterId: number;
  content: string;
  selectedText: string | null;
  createdAt: string;
  updatedAt: string;
  chapterTitleAr: string;
  bookId: number;
  bookTitleAr: string;
}

interface ProfileComment {
  id: number;
  chapterId: number;
  authorName: string;
  content: string;
  createdAt: string;
  chapterTitleAr: string;
  bookId: number;
  bookTitleAr: string;
}

function useTheme() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains("dark")
  );
  const toggle = () => {
    setDark((d) => {
      const next = !d;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  };
  return { dark, toggle };
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <Icon className="w-10 h-10 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export default function Profile() {
  const sessionId = getSessionId();
  const [tab, setTab] = useState<Tab>("gallery");
  const { dark, toggle } = useTheme();

  const { data: highlights = [], isLoading: loadingH } = useQuery<ProfileHighlight[]>({
    queryKey: ["profile-highlights", sessionId],
    queryFn: () => customFetch<ProfileHighlight[]>(`/api/profile/highlights?sessionId=${encodeURIComponent(sessionId)}`),
  });

  const { data: notes = [], isLoading: loadingN } = useQuery<ProfileNote[]>({
    queryKey: ["profile-notes", sessionId],
    queryFn: () => customFetch<ProfileNote[]>(`/api/profile/notes?sessionId=${encodeURIComponent(sessionId)}`),
  });

  const { data: comments = [], isLoading: loadingC } = useQuery<ProfileComment[]>({
    queryKey: ["profile-comments"],
    queryFn: () => customFetch<ProfileComment[]>(`/api/profile/comments`),
  });

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "gallery", label: "معرضي", icon: Highlighter, count: highlights.length },
    { id: "notes", label: "ملاحظاتي", icon: StickyNote, count: notes.length },
    { id: "comments", label: "التعليقات", icon: MessageSquare, count: comments.length },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">مكتبتي</h1>
            <p className="text-sm text-muted-foreground">
              ما جمعته من تظليلات وملاحظات وتعليقات
            </p>
          </div>
          {/* Preferences card */}
          <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">المظهر</p>
              <button
                onClick={toggle}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {dark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                {dark ? "الوضع الليلي" : "الوضع النهاري"}
              </button>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">الجلسة</p>
              <p className="text-xs font-mono text-muted-foreground/70 max-w-[100px] truncate">
                {sessionId.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted/50 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  tab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Gallery Tab */}
        {tab === "gallery" && (
          <div>
            {loadingH ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : highlights.length === 0 ? (
              <EmptyState icon={Highlighter} label="لم تظلّل أي نص بعد — ابدأ القراءة وظلّل ما يلفت انتباهك" />
            ) : (
              <div className="space-y-3">
                {highlights.map((h) => (
                  <Link
                    key={h.id}
                    href={`/book/${h.bookId}/chapter/${h.chapterId}`}
                    className="block bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-3 h-full min-h-[3rem] rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: h.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-base text-foreground leading-relaxed mb-2 line-clamp-3"
                          style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif" }}
                        >
                          {h.selectedText}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <BookOpen className="w-3 h-3" />
                          <span>{h.bookTitleAr}</span>
                          <ChevronLeft className="w-3 h-3 rotate-180" />
                          <span>{h.chapterTitleAr}</span>
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {tab === "notes" && (
          <div>
            {loadingN ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : notes.length === 0 ? (
              <EmptyState icon={StickyNote} label="لا توجد ملاحظات بعد — حدّد نصاً أثناء القراءة وأضف ملاحظتك" />
            ) : (
              <div className="space-y-3">
                {notes.map((n) => (
                  <Link
                    key={n.id}
                    href={`/book/${n.bookId}/chapter/${n.chapterId}`}
                    className="block bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {n.selectedText && (
                          <div
                            className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2 border-r-2 border-primary/40 mb-3 line-clamp-2 leading-relaxed"
                            style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif" }}
                          >
                            {n.selectedText}
                          </div>
                        )}
                        <p className="text-sm text-foreground leading-relaxed mb-2">{n.content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <BookOpen className="w-3 h-3" />
                          <span>{n.bookTitleAr}</span>
                          <ChevronLeft className="w-3 h-3 rotate-180" />
                          <span>{n.chapterTitleAr}</span>
                          <span className="mr-auto">
                            {new Date(n.createdAt).toLocaleDateString("ar-SA")}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Comments Tab */}
        {tab === "comments" && (
          <div>
            {loadingC ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : comments.length === 0 ? (
              <EmptyState icon={MessageSquare} label="لا توجد تعليقات بعد — كن أول من يُعلّق" />
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <Link
                    key={c.id}
                    href={`/book/${c.bookId}/chapter/${c.chapterId}#comments`}
                    className="block bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {c.authorName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">{c.authorName}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString("ar-SA")}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed mb-2 line-clamp-2">{c.content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <BookOpen className="w-3 h-3" />
                          <span>{c.bookTitleAr}</span>
                          <ChevronLeft className="w-3 h-3 rotate-180" />
                          <span>{c.chapterTitleAr}</span>
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
