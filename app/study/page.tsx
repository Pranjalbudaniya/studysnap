import React from "react";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { StudyWorkspace, type StudyWorkspaceData } from "../../components/study-workspace";
import { createClient, isSupabaseServerConfigured, type StudyPack } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Study Workspace — StudySnap",
  description: "Your focused revision library and study packs",
};

export default async function StudyPage() {
  let workspaceData: StudyWorkspaceData = { status: "guest" };

  if (isSupabaseServerConfigured()) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Query user's study packs
        const { data, error } = await supabase
          .from("study_packs")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          const errStr = `${error.message || ""} ${error.code || ""} ${error.details || ""}`.toLowerCase();
          if (
            error.code === "42P01" ||
            error.code === "PGRST116" ||
            errStr.includes("does not exist") ||
            errStr.includes("relation") ||
            errStr.includes("study_packs")
          ) {
            workspaceData = {
              status: "migration_missing",
              user: {
                id: user.id,
                email: user.email,
                user_metadata: user.user_metadata,
              },
            };
          } else {
            workspaceData = {
              status: "error",
              user: {
                id: user.id,
                email: user.email,
                user_metadata: user.user_metadata,
              },
            };
          }
        } else if (!data || data.length === 0) {
          workspaceData = {
            status: "empty",
            user: {
              id: user.id,
              email: user.email,
              user_metadata: user.user_metadata,
            },
          };
        } else {
          workspaceData = {
            status: "library",
            user: {
              id: user.id,
              email: user.email,
              user_metadata: user.user_metadata,
            },
            studyPacks: data as StudyPack[],
          };
        }
      } else {
        workspaceData = { status: "guest" };
      }
    } catch {
      workspaceData = { status: "error" };
    }
  } else {
    workspaceData = { status: "guest" };
  }

  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="workspace-main">
        <StudyWorkspace initialData={workspaceData} />
      </main>
    </div>
  );
}
