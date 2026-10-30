import { ScrapedJobListing } from "./types.js";

export const NIGERIAN_TECH_FEEDS: ScrapedJobListing[] = [
  {
    company: "Paystack",
    title: "2027 Software Engineering SIWES / IT Intern",
    source: "paystack_careers",
    applyUrl: "https://paystack.com/careers/internships-2027",
    locationHint: "Lagos / Remote",
    deadlineHint: "2027-02-15",
    rawText: `
Company: Paystack (Stripe Company)
Title: 2027 Software Engineering SIWES / IT Intern
Location: Lagos, Nigeria (Hybrid / Remote)
Target Intake: 2027 IT / SIWES
Compensation: ₦250,000/month stipend + meal allowance & health insurance
Eligibility: Open to enrolled 300L/400L Nigerian university students seeking 6-month or 1-year IT placement.
Requirements: Student ID or SIWES recommendation letter from your university. Zero passport or national ID needed upfront.
Tech Stack: Node.js, TypeScript, React, Go, PostgreSQL.
Deadline: 2027-02-15. Start Date: 2027-04-01.
    `.trim(),
  },
  {
    company: "Flutterwave",
    title: "2027 Cloud Infrastructure & DevOps Intern",
    source: "flutterwave_careers",
    applyUrl: "https://flutterwave.com/careers/cloud-intern-2027",
    locationHint: "Remote (Africa)",
    deadlineHint: "2027-02-28",
    rawText: `
Company: Flutterwave
Title: 2027 Cloud Infrastructure & DevOps Intern
Location: Remote (Nigeria / Africa)
Target Intake: 2027 IT / Summer
Compensation: $500 USD / month stipend + internet and laptop stipend
Eligibility: Enrolled undergraduate students in Computer Science, Electrical Engineering, or related STEM disciplines.
Zero foreign travel or passport requirement upfront. Digital onboarding.
Tech Stack: AWS, Docker, Kubernetes, Terraform, Linux.
Deadline: 2027-02-28. Start Date: 2027-05-01.
    `.trim(),
  },
  {
    company: "Moniepoint",
    title: "2027 Product Design (UI/UX) Intern",
    source: "moniepoint_careers",
    applyUrl: "https://moniepoint.com/careers/product-design-intern-2027",
    locationHint: "Lagos / Remote",
    deadlineHint: "2027-01-31",
    rawText: `
Company: Moniepoint Inc.
Title: 2027 Product Design (UI/UX) Intern
Location: Lagos, Nigeria (Hybrid)
Target Intake: 2027 SIWES / IT Cohort
Compensation: ₦200,000/month stipend + MacBook provided
Eligibility: University students with portfolio demonstrations of UI/UX problem-solving.
No foreign visa or passport needed. Student verification letter accepted.
Tech Stack: Figma, Design Systems, Prototyping, Usability Testing.
Deadline: 2027-01-31. Start Date: 2027-03-15.
    `.trim(),
  },
  {
    company: "Microsoft Africa Development Center (ADC)",
    title: "2027 Software Engineering Undergraduate Intern",
    source: "microsoft_adc_lagos",
    applyUrl: "https://careers.microsoft.com/students/us/en/job/2027-adc-swe",
    locationHint: "Lagos, Nigeria",
    deadlineHint: "2027-02-28",
    rawText: `
Company: Microsoft ADC (Africa Development Center)
Title: 2027 Software Engineering Undergraduate Intern
Location: Lagos, Nigeria (Hybrid)
Target Intake: 2027 IT / SIWES & Summer Period
Compensation: ₦450,000/month stipend + housing allowance + health coverage
Eligibility: Enrolled full-time university students graduating late 2027 or 2028.
Student transcript and university introduction letter only.
Tech Stack: C#, .NET, Azure, Python, Distributed Systems.
Deadline: 2027-02-28. Start Date: 2027-05-01.
    `.trim(),
  },
  {
    company: "Kuda Technologies",
    title: "2027 Data Science & Machine Learning Intern",
    source: "kuda_careers",
    applyUrl: "https://kuda.com/careers/data-intern-2027",
    locationHint: "Lagos / Remote",
    deadlineHint: "2027-03-01",
    rawText: `
Company: Kuda Bank
Title: 2027 Data Science & Machine Learning Intern
Location: Lagos, Nigeria (Remote)
Target Intake: 2027 SIWES Cohort
Compensation: ₦220,000/month stipend + monthly internet allowance
Eligibility: Enrolled STEM university students.
Tech Stack: Python, SQL, Pandas, Scikit-learn, BigQuery.
Deadline: 2027-03-01. Start Date: 2027-04-15.
    `.trim(),
  },
];

export async function scrapeNigerianTechJobs(): Promise<ScrapedJobListing[]> {
  console.log("🇳🇬 [Scraper: Nigerian Tech] Fetching curated 2027 SIWES / IT postings...");
  return NIGERIAN_TECH_FEEDS;
}
