import { getProfile } from "@/application/profile/profile-service";
import { listProjects } from "@/application/profile/project-service";
import { listJds, getJd } from "@/application/profile/jd-service";
import { ProfileEditor } from "@/features/profile/profile-editor";
import { ProjectsManager } from "@/features/profile/projects-manager";
import { JobDescriptions } from "@/features/profile/job-descriptions";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const profile = getProfile();
  const projects = listProjects();
  const jds = listJds()
    .map((jd) => getJd(jd.id))
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Your role, projects, and target jobs. This context personalizes the
          questions and feedback across the app.
        </p>
      </header>

      <ProfileEditor profile={profile} />
      <ProjectsManager projects={projects} />
      <JobDescriptions jds={jds} />
    </div>
  );
}
