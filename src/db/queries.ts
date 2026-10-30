import crypto from "node:crypto";
import { supabase } from "./client.js";
import { COURSES, LOCATIONS, STIPENDS } from "../config/taxonomy.js";
import { calculatePriorityScore } from "../ingest/scorer.js";
import { sanitizeApplyUrl } from "../utils/security.js";

export type LocationCategory = "nigeria" | "africa_remote" | "overseas_remote" | "overseas_relocate";
export type WorkMode = "remote" | "onsite" | "hybrid";
export type ApplicationStatus =
  | "queued"
  | "sent"
  | "applied"
  | "not_eligible"
  | "interviewing"
  | "offered"
  | "rejected"
  | "expired";

export interface UserProfileInput {
  telegramId: number;
  username?: string;
  firstName?: string;
  courseKey: string;
  customCourseName?: string;
  locationKey: string;
  stipendKey: string;
}

export interface UserProfileRecord {
  id?: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  course_of_study: string;
  preferred_locations: LocationCategory[];
  preferred_work_modes?: WorkMode[];
  prioritize_stipend: boolean;
  prioritize_no_national_id: boolean;
  target_intake_year: number;
  daily_limit: number;
  is_active: boolean;
  updated_at: string;
}

export interface InternshipRecord {
  id: string;
  short_id: string;
  title: string;
  company: string;
  source_name: string;
  apply_url: string;
  url_hash: string;
  course_tags: string[];
  role_category?: string;
  tech_stack: string[];
  location_category: LocationCategory;
  work_mode: WorkMode;
  city_or_country: string;
  has_stipend: boolean;
  stipend_note?: string | null;
  requires_national_id: boolean;
  id_requirement_note?: string | null;
  target_year: number;
  start_date?: string | null;
  deadline?: string | null;
  summary_bullets: string[];
  priority_score: number;
  is_active: boolean;
  created_at?: string;
}

export interface UserApplicationRecord {
  id?: string;
  user_id?: string;
  telegram_id: number;
  internship_id: string;
  status: ApplicationStatus;
  telegram_message_id?: number | null;
  sent_count: number;
  first_sent_at?: string;
  last_sent_at?: string;
  applied_at?: string;
  next_followup_at?: string;
  followup_count: number;
  user_notes?: string;
}

export interface DigestItem extends InternshipRecord {
  is_rollover: boolean;
  sent_count: number;
}

// In-memory fallback stores
const memoryUsers = new Map<number, UserProfileRecord>();
const memoryInternships = new Map<string, InternshipRecord>(); // key: id or short_id
const memoryApplications = new Map<string, UserApplicationRecord>(); // key: `${telegram_id}_${internship_id}`

export function generateShortId(): string {
  return crypto.randomBytes(4).toString("hex");
}

export function generateUrlHash(url: string): string {
  return crypto.createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

export async function upsertUserProfile(input: UserProfileInput): Promise<UserProfileRecord> {
  const course = COURSES[input.courseKey] || COURSES.cs;
  const location = LOCATIONS[input.locationKey] || LOCATIONS.both;
  const stipend = STIPENDS[input.stipendKey] || STIPENDS.preferred;

  const courseOfStudy =
    input.courseKey === "other" && input.customCourseName
      ? input.customCourseName.trim()
      : course.dbValue;

  const record: UserProfileRecord = {
    telegram_id: input.telegramId,
    username: input.username,
    first_name: input.firstName,
    course_of_study: courseOfStudy,
    preferred_locations: location.dbValues,
    prioritize_stipend: stipend.prioritizeStipend,
    prioritize_no_national_id: true,
    target_intake_year: 2027,
    daily_limit: 20,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  memoryUsers.set(input.telegramId, record);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("users")
        .upsert(
          {
            telegram_id: record.telegram_id,
            username: record.username,
            first_name: record.first_name,
            course_of_study: record.course_of_study,
            preferred_locations: record.preferred_locations,
            prioritize_stipend: record.prioritize_stipend,
            prioritize_no_national_id: record.prioritize_no_national_id,
            target_intake_year: record.target_intake_year,
            daily_limit: record.daily_limit,
            is_active: record.is_active,
            updated_at: record.updated_at,
          },
          { onConflict: "telegram_id" }
        )
        .select()
        .single();

      if (error) {
        console.error(`[DB Error] Failed to upsert user ${input.telegramId} in Supabase:`, error.message);
      } else if (data) {
        record.id = data.id;
        return data as UserProfileRecord;
      }
    } catch (err) {
      console.error(`[DB Error] Supabase upsert exception:`, err);
    }
  }

  return record;
}

export async function getUserProfile(telegramId: number): Promise<UserProfileRecord | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      if (!error && data) {
        return data as UserProfileRecord;
      }
    } catch (err) {
      console.error(`[DB Error] Supabase get user exception:`, err);
    }
  }

  return memoryUsers.get(telegramId) || null;
}

export async function upsertInternship(
  data: Omit<InternshipRecord, "id" | "short_id" | "url_hash" | "priority_score"> & {
    id?: string;
    short_id?: string;
    url_hash?: string;
    priority_score?: number;
  }
): Promise<InternshipRecord> {
  const safeApplyUrl = sanitizeApplyUrl(data.apply_url);
  const url_hash = data.url_hash || generateUrlHash(safeApplyUrl);

  // Check if this url_hash already exists in memory
  let existingId = data.id;
  let existingShortId = data.short_id;

  for (const existing of memoryInternships.values()) {
    if (existing.url_hash === url_hash) {
      existingId = existing.id;
      existingShortId = existing.short_id;
      break;
    }
  }

  // If supabase is available and we don't have existing IDs, check Supabase
  if (supabase && (!existingId || !existingShortId)) {
    try {
      const { data: dbExisting } = await supabase
        .from("internships")
        .select("id, short_id")
        .eq("url_hash", url_hash)
        .maybeSingle();

      if (dbExisting) {
        existingId = dbExisting.id;
        existingShortId = dbExisting.short_id;
      }
    } catch (err) {
      // Ignore lookup error and fall back to generating new IDs
    }
  }

  const short_id = existingShortId || generateShortId();
  const id = existingId || crypto.randomUUID();
  const priority_score =
    data.priority_score ??
    calculatePriorityScore({
      requires_national_id: data.requires_national_id,
      has_stipend: data.has_stipend,
      target_year: data.target_year,
      location_category: data.location_category,
      deadline: data.deadline,
    });

  const record: InternshipRecord = {
    ...data,
    apply_url: safeApplyUrl,
    id,
    short_id,
    url_hash,
    priority_score,
  };

  memoryInternships.set(record.id, record);
  memoryInternships.set(record.short_id, record);

  if (supabase) {
    try {
      const { data: dbData, error } = await supabase
        .from("internships")
        .upsert(record, { onConflict: "url_hash" })
        .select()
        .single();

      if (error) {
        console.error(`[DB Error] Failed to upsert internship ${record.title}:`, error.message);
      } else if (dbData) {
        memoryInternships.set(dbData.id, dbData as InternshipRecord);
        memoryInternships.set(dbData.short_id, dbData as InternshipRecord);
        return dbData as InternshipRecord;
      }
    } catch (err) {
      console.error(`[DB Error] Supabase internship upsert exception:`, err);
    }
  }

  return record;
}

export async function getInternshipByShortId(shortId: string): Promise<InternshipRecord | null> {
  const mem = memoryInternships.get(shortId);
  if (mem) return mem;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("internships")
        .select("*")
        .eq("short_id", shortId)
        .maybeSingle();

      if (!error && data) {
        memoryInternships.set(data.short_id, data as InternshipRecord);
        memoryInternships.set(data.id, data as InternshipRecord);
        return data as InternshipRecord;
      }
    } catch (err) {
      console.error(`[DB Error] Supabase get internship exception:`, err);
    }
  }

  return null;
}

export async function updateApplicationStatus(
  telegramId: number,
  shortId: string,
  status: ApplicationStatus,
  options?: {
    telegramMessageId?: number;
    userNotes?: string;
  }
): Promise<UserApplicationRecord | null> {
  const internship = await getInternshipByShortId(shortId);
  if (!internship) return null;

  const key = `${telegramId}_${internship.id}`;
  const now = new Date();
  const existing = memoryApplications.get(key);

  const followupAt = status === "applied" ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined;

  const updated: UserApplicationRecord = {
    telegram_id: telegramId,
    internship_id: internship.id,
    status,
    telegram_message_id: options?.telegramMessageId ?? existing?.telegram_message_id,
    sent_count: existing ? existing.sent_count : 1,
    first_sent_at: existing?.first_sent_at || now.toISOString(),
    last_sent_at: now.toISOString(),
    applied_at: status === "applied" ? now.toISOString() : existing?.applied_at,
    next_followup_at: followupAt ?? existing?.next_followup_at,
    followup_count: existing ? existing.followup_count : 0,
    user_notes: options?.userNotes ?? existing?.user_notes,
  };

  memoryApplications.set(key, updated);

  if (supabase) {
    try {
      // Find user UUID
      const user = await getUserProfile(telegramId);
      if (user?.id) {
        await supabase.from("user_applications").upsert(
          {
            user_id: user.id,
            internship_id: internship.id,
            status: updated.status,
            telegram_message_id: updated.telegram_message_id,
            sent_count: updated.sent_count,
            last_sent_at: updated.last_sent_at,
            applied_at: updated.applied_at,
            next_followup_at: updated.next_followup_at,
            user_notes: updated.user_notes,
            updated_at: now.toISOString(),
          },
          { onConflict: "user_id,internship_id" }
        );
      }
    } catch (err) {
      console.error(`[DB Error] Failed to update application status:`, err);
    }
  }

  return updated;
}

export async function markInternshipDispatched(
  telegramId: number,
  internshipId: string,
  messageId?: number,
  sentAt?: Date
) {
  const key = `${telegramId}_${internshipId}`;
  const existing = memoryApplications.get(key);
  const now = (sentAt || new Date()).toISOString();

  const app: UserApplicationRecord = {
    telegram_id: telegramId,
    internship_id: internshipId,
    status: existing ? existing.status : "sent",
    telegram_message_id: messageId ?? existing?.telegram_message_id,
    sent_count: (existing?.sent_count || 0) + 1,
    first_sent_at: existing?.first_sent_at || now,
    last_sent_at: now,
    followup_count: existing?.followup_count || 0,
  };

  memoryApplications.set(key, app);

  if (supabase) {
    try {
      const user = await getUserProfile(telegramId);
      if (user?.id) {
        await supabase.from("user_applications").upsert(
          {
            user_id: user.id,
            internship_id: internshipId,
            status: app.status,
            telegram_message_id: app.telegram_message_id,
            sent_count: app.sent_count,
            first_sent_at: app.first_sent_at,
            last_sent_at: app.last_sent_at,
            updated_at: now,
          },
          { onConflict: "user_id,internship_id" }
        );
      }
    } catch (err) {
      console.error(`[DB Error] markInternshipDispatched failed:`, err);
    }
  }
}

/**
 * Fetch Daily User Digest (up to 20 roles):
 * 1. Resend previously sent roles (status = 'sent') that the user hasn't acted on yet (Rollover)
 * 2. Fill remainder up to limit with queued opportunities ordered by priority_score DESC
 */
export async function getDailyUserDigest(telegramId: number, limit: number = 20): Promise<DigestItem[]> {
  const user = await getUserProfile(telegramId);
  if (!user) return [];

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("get_daily_user_digest", {
        p_telegram_id: telegramId,
        p_limit: limit,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          ...item,
          id: item.internship_id || item.id,
        })) as DigestItem[];
      }
    } catch (err) {
      console.error(`[DB Error] Supabase RPC get_daily_user_digest failed, falling back to memory:`, err);
    }
  }

  // In-memory fallback calculation
  const allInternships = Array.from(memoryInternships.values()).filter(
    (item, index, self) => self.findIndex((i) => i.id === item.id) === index
  );

  const rollovers: DigestItem[] = [];
  const fresh: DigestItem[] = [];

  for (const item of allInternships) {
    if (!item.is_active) continue;
    if (item.target_year !== user.target_intake_year) continue;

    // Check course match (exact, slug, substring, or general tech)
    const userCourseLower = user.course_of_study.toLowerCase();
    const courseMatch =
      item.course_tags.includes(user.course_of_study) ||
      user.course_of_study === "other" ||
      item.course_tags.some(
        (t) =>
          t.toLowerCase().includes(userCourseLower) ||
          userCourseLower.includes(t.toLowerCase()) ||
          t === "general_tech"
      );
    if (!courseMatch) continue;

    // Check location match
    const locationMatch = user.preferred_locations.includes(item.location_category);
    if (!locationMatch) continue;

    const key = `${telegramId}_${item.id}`;
    const app = memoryApplications.get(key);

    if (app && app.status === "sent") {
      // Rollover item: previously sent, not marked Applied or Not Eligible
      rollovers.push({
        ...item,
        is_rollover: true,
        sent_count: app.sent_count,
      });
    } else if (!app || app.status === "queued") {
      // Fresh match
      fresh.push({
        ...item,
        is_rollover: false,
        sent_count: 0,
      });
    }
  }

  // Sort fresh items by user priority
  fresh.sort((a, b) => {
    if (user.prioritize_no_national_id) {
      if (!a.requires_national_id && b.requires_national_id) return -1;
      if (a.requires_national_id && !b.requires_national_id) return 1;
    }
    if (user.prioritize_stipend) {
      if (a.has_stipend && !b.has_stipend) return -1;
      if (!a.has_stipend && b.has_stipend) return 1;
    }
    return b.priority_score - a.priority_score;
  });

  const combined = [...rollovers, ...fresh].slice(0, limit);
  return combined;
}

export async function getUserStats(telegramId: number) {
  let appliedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;
  let interviewingCount = 0;
  let offeredCount = 0;

  for (const [key, app] of memoryApplications.entries()) {
    if (key.startsWith(`${telegramId}_`)) {
      if (app.status === "applied") appliedCount++;
      else if (app.status === "not_eligible") rejectedCount++;
      else if (app.status === "sent") pendingCount++;
      else if (app.status === "interviewing") interviewingCount++;
      else if (app.status === "offered") offeredCount++;
    }
  }

  return {
    applied: appliedCount,
    notEligible: rejectedCount,
    pendingAction: pendingCount,
    interviewing: interviewingCount,
    offered: offeredCount,
  };
}

/**
 * Seed realistic 2027 internship opportunities for testing and initial dispatch
 */
export async function seedSampleInternships() {
  const samples = [
    {
      title: "2027 Software Engineering Intern (IT/SIWES)",
      company: "Paystack / Stripe",
      source_name: "paystack_careers",
      apply_url: "https://paystack.com/careers/internships-2027",
      course_tags: ["computer_science", "electrical_engineering"],
      role_category: "Software Engineering",
      tech_stack: ["TypeScript", "Node.js", "React", "PostgreSQL"],
      location_category: "nigeria" as LocationCategory,
      work_mode: "hybrid" as WorkMode,
      city_or_country: "Lagos, Nigeria",
      has_stipend: true,
      stipend_note: "₦250,000/month stipend + lunch & health coverage",
      requires_national_id: false,
      id_requirement_note: "Student ID or admission letter only; no passport or NIN required upfront",
      target_year: 2027,
      start_date: "2027-04-01",
      deadline: "2027-01-15",
      summary_bullets: [
        "Hands-on building of payment infrastructure serving millions across Africa",
        "Mentorship from senior engineers, dedicated project ship by week 12",
        "Conversion potential to full-time Associate SWE upon graduation",
      ],
      is_active: true,
    },
    {
      title: "2027 Junior Cloud & DevOps Intern",
      company: "Flutterwave",
      source_name: "flutterwave_jobs",
      apply_url: "https://flutterwave.com/careers/cloud-intern-2027",
      course_tags: ["computer_science", "electrical_engineering"],
      role_category: "DevOps & Cloud",
      tech_stack: ["AWS", "Terraform", "Docker", "Kubernetes", "Linux"],
      location_category: "africa_remote" as LocationCategory,
      work_mode: "remote" as WorkMode,
      city_or_country: "Remote (Africa)",
      has_stipend: true,
      stipend_note: "USD $500/month stipend",
      requires_national_id: false,
      id_requirement_note: "Open to enrolled African university undergraduates; no foreign visa required",
      target_year: 2027,
      start_date: "2027-05-01",
      deadline: "2027-02-28",
      summary_bullets: [
        "Manage cloud clusters and automated CI/CD pipelines",
        "Remote work allowance and home office stipend provided",
      ],
      is_active: true,
    },
    {
      title: "2027 Product Design (UI/UX) Intern",
      company: "Moniepoint",
      source_name: "moniepoint_jobs",
      apply_url: "https://moniepoint.com/careers/design-intern-2027",
      course_tags: ["product_design", "computer_science"],
      role_category: "Product Design",
      tech_stack: ["Figma", "Design Systems", "Prototyping", "User Research"],
      location_category: "nigeria" as LocationCategory,
      work_mode: "hybrid" as WorkMode,
      city_or_country: "Lagos / Remote",
      has_stipend: true,
      stipend_note: "₦200,000/month + MacBook provided",
      requires_national_id: false,
      id_requirement_note: "Portfolio link required; no national identity card barrier",
      target_year: 2027,
      start_date: "2027-03-15",
      deadline: "2027-01-30",
      summary_bullets: [
        "Design merchant onboarding and POS terminal interface experiences",
        "Direct collaboration with product managers and field research teams",
      ],
      is_active: true,
    },
    {
      title: "2027 Global Summer Software Engineering Intern",
      company: "Canonical (Ubuntu)",
      source_name: "canonical_global",
      apply_url: "https://canonical.com/careers/internships",
      course_tags: ["computer_science", "electrical_engineering"],
      role_category: "Systems Engineering",
      tech_stack: ["Go", "Python", "C++", "Linux", "Open Source"],
      location_category: "overseas_remote" as LocationCategory,
      work_mode: "remote" as WorkMode,
      city_or_country: "Global Remote",
      has_stipend: true,
      stipend_note: "Competitive hourly rate in USD (~$1,200/mo)",
      requires_national_id: false,
      id_requirement_note: "Fully remote contract; zero travel or embassy requirements",
      target_year: 2027,
      start_date: "2027-06-01",
      deadline: "2027-03-01",
      summary_bullets: [
        "Contribute code directly to the Ubuntu Linux kernel and cloud packages",
        "100% remote asynchronous work culture across global timezones",
      ],
      is_active: true,
    },
    {
      title: "2027 AI & Data Engineering Intern",
      company: "Kuda Bank",
      source_name: "kuda_careers",
      apply_url: "https://kuda.com/careers/interns-2027",
      course_tags: ["data_science", "computer_science"],
      role_category: "Data Science",
      tech_stack: ["Python", "SQL", "Spark", "FastAPI", "dbt"],
      location_category: "nigeria" as LocationCategory,
      work_mode: "remote" as WorkMode,
      city_or_country: "Lagos / Remote",
      has_stipend: true,
      stipend_note: "₦220,000/month + internet allowance",
      requires_national_id: false,
      id_requirement_note: "School verification letter only",
      target_year: 2027,
      start_date: "2027-04-01",
      deadline: "2027-02-15",
      summary_bullets: [
        "Build credit risk models and real-time transaction anomaly detectors",
        "Mentorship by principal data scientists and modern MLOps stack",
      ],
      is_active: true,
    },
  ];

  for (const s of samples) {
    await upsertInternship(s);
  }
}
