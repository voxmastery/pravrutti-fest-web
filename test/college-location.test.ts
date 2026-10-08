import { describe, expect, it } from "vitest";
import {
  bucketForTeam,
  collegeBucket,
  holdsLocationPlace,
  normalizeCollege,
} from "@/lib/college-location";

describe("collegeBucket", () => {
  it("folds spelling into one college name", () => {
    expect(normalizeCollege("M.S. Ramaiah University of Applied Sciences")).toBe(
      "m s ramaiah university of applied sciences",
    );
    expect(collegeBucket("M S Ramaiaha university of applied sciences")).toBe("bengaluru");
    expect(normalizeCollege("Banglore institute of technology")).toBe("bangalore institute of technology");
    expect(normalizeCollege("P E S College of Engineering, Mandya")).toBe("pes college of engineering mandya");
  });

  it("places Bengaluru colleges, including names that never say the city", () => {
    for (const name of [
      "Ramaiah University of Applied Sciences",
      "MSRUAS",
      "RUAS",
      "Ramiah University of applied sciences",
      "RV University",
      "RV College of Engineering",
      "PES University",
      "PES",
      "REVA University",
      "Nitte Meenakshi Institute of Technology",
      "NMIT",
      "Bangalore Institute of Technology",
      "Banglore institute of technology",
      "Dayananda Sagar College of Engineering",
      "AMC Engineering College",
      "Sapthagiri NPS University",
      "JSS Academy of Technical Education Bengaluru",
      "M S Ramaiah University of Applied Sciences (Bangalore)",
      "BIT",
      "M.S.Ramaiah University of Applied Sciences",
      "SVYASA DEEMED TO BE UNIVERSITY",
      "Dr.Ambedkar Institute of technology",
      "Nagarjuna College Of Engineering & Technology",
    ]) {
      expect(collegeBucket(name), name).toBe("bengaluru");
    }
  });

  it("places the rest of Karnataka outside Bengaluru", () => {
    for (const name of [
      "Mangalore institute of technology and engineering",
      "Manglore Institute Of Technology and Engineering (MITE)",
      "Malnad college of engineering",
      "Jawaharlal Nehru New College of engineering",
      "JNN Collage of Engineering",
      "KLE Technological University",
      "P E S College of Engineering Mandya",
      "PES College of Engineering",
      "Pes institute of technology and management shivmogha",
      "Channabasaveshwara Institute of Technology,Gubbi",
      "Shridevi institute of engineering and technology, Tumkuru",
      "Lingaraj Appa Engineering College",
      "Adhichunchangiri university",
      "Yenepoya deemed to be university",
      "Ghausia collage of engineering Ramanagara",
      "Sri Siddhartha Institute Of Technology",
      "Visvesvaraya Technological University (VTU), Belagavi, Karnataka",
    ]) {
      expect(collegeBucket(name), name).toBe("karnataka");
    }
  });

  it("keeps a Bengaluru campus of a Karnataka university in Bengaluru", () => {
    expect(collegeBucket("Yenepoya university Bangalore")).toBe("bengaluru");
    expect(collegeBucket("Nitte meenakshi institute of technology bangalore")).toBe("bengaluru");
  });

  it("places colleges outside Karnataka", () => {
    for (const name of [
      "VIT AP University",
      "VIT-AP",
      "MOHAN BABU UNIVERSITY",
      "SRM Institute of Science and Technology",
      "SRM ktr",
      "Rajalakshmi engineering college",
      "KONGU ENGINEERING COLLEGE",
      "Buddha Institute of Technology (BIT), Gorakhpur",
      "university of hyderabad",
      "Nims University (NU), Jaipur",
      "ADITYA COLLEGE OF ENGINEERING AND TECHNOLOGY",
      "Jeppiaar Engineering College",
      "Er.perumal manimekai college of engineering",
      "Indra Ganesan College of Engineering",
    ]) {
      expect(collegeBucket(name), name).toBe("outside");
    }
  });

  it("does not guess when the text is not a college we can place", () => {
    for (const name of ["", "College", "University", "MS R", "VTU", "MIT collage", "vvit", "1BI25EC109", "someone@gmail.com", "Totally Unknown Institute of Parts"]) {
      expect(collegeBucket(name), name).toBe("unknown");
    }
  });
});

describe("location counts", () => {
  const lead = {
    college: "RV University",
    fee: "Rs. 200/-",
    payment: "paid",
    status: "confirmed",
    appliedAt: "2026-10-01T00:00:00.000Z",
  };
  const mate = {
    college: "Mangalore Institute of Technology",
    fee: "Covered by team lead",
    payment: "not_required",
    status: "confirmed",
    appliedAt: "2026-10-02T00:00:00.000Z",
  };

  it("counts a team by the lead, and ignores declined and refunded rows", () => {
    expect(bucketForTeam([lead, mate])).toBe("bengaluru");
    expect(holdsLocationPlace({ status: "declined", payment: "refunded" })).toBe(false);
    expect(holdsLocationPlace({ status: "pending", payment: "awaiting" })).toBe(true);
    expect(holdsLocationPlace({ status: "confirmed", payment: "refunded" })).toBe(false);
    expect(holdsLocationPlace({ status: "cancelled", payment: "paid" })).toBe(false);
  });

  it("uses a confirmed teammate when the lead is no longer in", () => {
    expect(
      bucketForTeam([
        { ...lead, status: "declined", payment: "refunded" },
        mate,
      ]),
    ).toBe("karnataka");
  });
});
