// A fictional sample resume. Layout-engine format (see toLayoutData in app.js for the editor format).
export const SAMPLE_STATE = {
  name: "Taylor Morgan",
  email: "tmorgan@umich.edu",
  phone: "(734) 555-0142",
  linkedin: "linkedin.com/in/taylor-morgan-example",
  education: [
    {
      org: "University of Michigan", loc: "Ann Arbor, MI",
      sub: "Stephen M. Ross School of Business",
      deg: "Bachelor of Business Administration, May 2029",
      bullets: [
        "GPA 3.8/4.0 | Emphasis in Finance and Technology & Operations",
        "Lakeview High School, Columbus, OH: GPA 3.95/4.0 | SAT 1510/1600 | National Merit Commended Scholar",
        "Activities: Michigan Investment Group | Club Tennis | First-Generation Student Mentors",
      ],
    },
  ],
  experience: [
    {
      org: "Huron Valley Credit Union", loc: "Ann Arbor, MI", title: "Commercial Lending Intern",
      startYear: "2026", endYear: "2026", present: false, label: "Summer(s)",
      bullets: [
        "Built a three-statement model for a $2.4M equipment loan to a regional bakery; the credit committee approved the loan using the model's downside case",
        "Screened 40+ small-business applications for debt service coverage and collateral; flagged 6 for deeper review and wrote the summary memos",
        "Rebuilt the team's pipeline tracker in Excel, cutting the weekly reporting routine from 3 hours to 30 minutes",
      ],
    },
    {
      org: "Morgan Lawn & Snow", loc: "Columbus, OH", title: "Founder",
      startYear: "2022", endYear: "2025", present: false, label: "",
      bullets: [
        "Grew a neighborhood lawn and snow-removal service from 4 to 37 recurring customers and $31K in lifetime revenue",
        "Hired and scheduled 5 part-time workers; raised retention by moving from per-job pay to guaranteed weekly hours",
        "Priced seasonal contracts from a simple cost model; held gross margin above 55% through two fuel price spikes",
      ],
    },
    {
      org: "Columbus Food Rescue", loc: "Columbus, OH", title: "Volunteer Route Coordinator",
      startYear: "2023", endYear: "2025", present: false, label: "Volunteer",
      bullets: [
        "Coordinated 12 weekly pickup routes across 20 grocers and restaurants; recovered about 9,000 pounds of food per month",
        "Recruited and trained 25 student drivers; wrote the onboarding guide the organization still uses",
      ],
    },
  ],
  additional: [
    "Languages: conversational Spanish",
    "Interests: distance running (two half marathons), chess, Ohio diners, and restoring a 1985 road bike",
  ],
};
