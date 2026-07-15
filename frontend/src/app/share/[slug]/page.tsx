import { getPublicResume } from "@/app/actions/sharing";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Briefcase, FolderKanban, Sparkles, Zap } from "lucide-react";

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

// Define interface for what getPublicResume returns
interface Experience {
  company: string;
  title: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  current: boolean;
  description: string;
}

interface Project {
  name: string;
  description: string;
  technologies: string[];
}

interface Skill {
  name: string;
}

interface ResumeData {
  name: string | null;
  email: string;
  experiences: Experience[];
  projects: Project[];
  educations: any[]; // Less critical for now
  skills: Skill[];
  publications: any[];
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const resume = await getPublicResume(slug) as unknown as ResumeData | null;
  if (!resume) return { title: "Resume Not Found" };

  return {
    title: `${resume.name}'s Resume | MatchQuill`,
    description: `Professional resume of ${resume.name}`,
  };
}

export default async function PublicResumePage({ params }: Props) {
  const { slug } = await params;
  const resume = await getPublicResume(slug) as unknown as ResumeData | null;

  if (!resume) {
    notFound();
  }

  // Simple rendering of the resume data
  // In a real app, this would use the ResumeRenderer component
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--background)' }}>
      <div
        className="max-w-4xl mx-auto p-1.5 rounded-[2rem]"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="rounded-[calc(2rem-0.375rem)] overflow-hidden" style={{ background: 'var(--card)' }}>
          {/* Header */}
          <div
            className="p-8 text-center"
            style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%)' }}
          >
            <h1 className="text-4xl font-bold" style={{ color: 'var(--primary-foreground)', fontFamily: 'var(--font-display)' }}>
              {resume.name}
            </h1>
            {resume.email && (
              <p className="mt-2" style={{ color: 'var(--primary-foreground)', opacity: 0.85 }}>
                {resume.email}
              </p>
            )}
          </div>

          {/* Content */}
          <div className="p-8 space-y-10">
            {/* Experience */}
            {resume.experiences && resume.experiences.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold pb-3 mb-5 flex items-center gap-2 border-b"
                  style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
                >
                  <Briefcase size={22} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                  Experience
                </h2>
                <div className="space-y-6">
                  {resume.experiences.map((exp: any, i: number) => (
                    <div key={i}>
                      <div className="flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1">
                        <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                          {exp.title}
                        </h3>
                        <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                          {new Date(exp.startDate).getFullYear()}{exp.current ? ' - Present' : exp.endDate ? ` - ${new Date(exp.endDate).getFullYear()}` : ''}
                        </span>
                      </div>
                      <p className="text-lg" style={{ color: 'var(--primary)' }}>{exp.company}</p>
                      <p className="mt-2 whitespace-pre-wrap" style={{ color: 'var(--foreground-secondary)' }}>{exp.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Projects */}
            {resume.projects && resume.projects.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold pb-3 mb-5 flex items-center gap-2 border-b"
                  style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
                >
                  <FolderKanban size={22} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                  Projects
                </h2>
                <div className="space-y-6">
                  {resume.projects.map((proj: any, i: number) => (
                    <div key={i}>
                      <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{proj.name}</h3>
                      <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>{proj.description}</p>
                      {proj.technologies && proj.technologies.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {proj.technologies.map((tech: string, j: number) => (
                            <span
                              key={j}
                              className="px-2 py-1 rounded text-sm"
                              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Skills */}
            {resume.skills && resume.skills.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold pb-3 mb-5 flex items-center gap-2 border-b"
                  style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
                >
                  <Zap size={22} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                  Skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {resume.skills.map((skill: any, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full font-medium"
                      style={{ background: 'var(--muted)', color: 'var(--primary)' }}
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div
            className="p-4 text-center text-sm border-t"
            style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
          >
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              Powered by <Sparkles size={14} strokeWidth={1.75} style={{ color: 'var(--primary)' }} /> MatchQuill
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
