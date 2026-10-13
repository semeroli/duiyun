import type { Metadata } from "next";
import AdminClient from "@/components/AdminClient";

export const metadata: Metadata = {
  title: "管理后台 · 对韵",
  // 后台绝不能进搜索结果
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
