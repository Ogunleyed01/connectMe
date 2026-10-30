export interface RawJobFeedItem {
  company: string;
  title: string;
  source: string;
  applyUrl: string;
  rawText: string;
}

export const SAMPLE_2027_FEEDS: RawJobFeedItem[] = [
  {
    company: "Microsoft ADC (Africa Development Center)",
    title: "2027 Software Engineering Intern (Nigeria)",
    source: "microsoft_careers",
    applyUrl: "https://careers.microsoft.com/students/us/en/job/2027-adc-swe",
    rawText: `
Microsoft Africa Development Center (ADC) Lagos is seeking enrolled undergraduate students for our 2027 Software Engineering Internship.
Requirements: Currently enrolled in Computer Science, Electrical Engineering, or related STEM degree, graduating late 2027 or 2028.
Locations: Lagos, Nigeria (Hybrid / Onsite).
Compensation: Competitive monthly stipend (₦450,000/mo), health insurance, housing assistance, and laptop provided.
Eligibility: Open to all Nigerian university students. Only university ID and transcript required upfront. No foreign passport needed.
Tech: C#, .NET, Azure, TypeScript, Python.
Deadline: 2027-02-28. Start: 2027-05-01.
    `,
  },
  {
    company: "GitLab",
    title: "2027 Global Remote Frontend Intern",
    source: "gitlab_jobs",
    applyUrl: "https://about.gitlab.com/jobs/apply/frontend-intern-2027",
    rawText: `
Join GitLab's all-remote team as an Intern for the Summer 2027 intake.
Location: Worldwide Remote (including Africa).
Compensation: Paid internship with international USD hourly rate ($25/hr).
Requirements: Knowledge of Vue.js, JavaScript, HTML/CSS, Git.
No national ID barriers or visas needed; contract signed digitally.
Deadline: 2027-03-15. Start: 2027-06-01.
    `,
  },
  {
    company: "Interswitch Group",
    title: "2027 Graduate / IT Technical Intern",
    source: "interswitch_careers",
    applyUrl: "https://interswitchgroup.com/careers/it-intern-2027",
    rawText: `
Interswitch is Africa's premier integrated payments company.
We are hiring Industrial Training (IT/SIWES) students for the 2027 cohort.
Location: Lagos / Abuja (Hybrid).
Stipend: Paid monthly stipend (₦180,000/mo) + meal vouchers.
Fields: Computer Science, Computer Engineering, System Engineering.
Required: Letter of introduction from university SIWES director.
Deadline: 2027-01-31. Start: 2027-03-01.
    `,
  },
];
