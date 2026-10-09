import type { EnglishCase } from "./checks";

const SLOW_LIST = "Tell me about a time you improved performance of a list screen.";
const STATE_Q = "Why did you choose your state management library on your last project?";

export const englishCases: EnglishCase[] = [
  {
    id: "en-you-know-what-my-mean",
    prompt: STATE_Q,
    transcript:
      "We picked Zustand because it is small and the team could learn it in one afternoon. We did not need middleware or devtools at that stage, you know what my mean, it was a simple dashboard.",
    allowImprovedVersion: false,
    expect: { mustFlag: ["you know what my mean"] },
  },
  {
    id: "en-yeah-exactly-is-natural",
    prompt: STATE_Q,
    transcript:
      "So the interviewer asked if we needed global state for everything, and I said no, only for auth and filters. Yeah, exactly, everything else stayed local to the component, which kept the tree simple.",
    allowImprovedVersion: false,
    expect: { mustNotFlag: ["yeah, exactly"] },
  },
  {
    id: "en-single-you-know-is-natural",
    prompt: SLOW_LIST,
    transcript:
      "The list screen took about eight seconds to load because we called five endpoints one after another. You know, the classic waterfall problem. I merged them into a single request on the backend and added a thirty second cache.",
    allowImprovedVersion: false,
    expect: { mustNotFlag: ["you know"] },
  },
  {
    id: "en-actually-i-mean-natural",
    prompt: SLOW_LIST,
    transcript:
      "Actually, the slow part was not the rendering, it was the network. I mean, we had five sequential calls, and each one waited for the previous. So I batched them and the load time dropped to about one and a half seconds.",
    allowImprovedVersion: false,
    expect: { mustNotFlag: ["actually", "I mean"] },
  },
  {
    id: "en-filler-crutch",
    prompt: SLOW_LIST,
    transcript:
      "So, basically, the list was, like, basically slow, you know, and basically we had, like, too many calls, you know, and basically I, like, fixed it by, you know, basically merging them.",
    allowImprovedVersion: false,
    expect: { anyCode: ["filler", "fluency"] },
  },
  {
    id: "en-grammar-subject-verb",
    prompt: SLOW_LIST,
    transcript:
      "The API are returning a slow response because it have too many joins. I optimize the query and now the screen load faster than before.",
    allowImprovedVersion: false,
    expect: { anyCode: ["grammar"] },
  },
  {
    id: "en-grammar-unnatural-phrase",
    prompt: SLOW_LIST,
    transcript:
      "I make a refactor for the list component and it become more clean. After that the performance is increased very much, so the customer is feeling happy.",
    allowImprovedVersion: false,
    expect: { anyCode: ["grammar", "vocabulary", "unnatural_phrase"] },
  },
  {
    id: "en-main-point-late",
    prompt: SLOW_LIST,
    transcript:
      "So last year our team had just finished a big release and everyone was tired, and the customers kept sending feedback, and I had just moved to a new module. In the middle of that, there was a list screen that was slow. The problem was that it called five APIs in sequence and took eight seconds.",
    allowImprovedVersion: false,
    expect: { anyCode: ["main_point_late", "too_long"] },
  },
  {
    id: "en-rambling-repetitive",
    prompt: STATE_Q,
    transcript:
      "I chose Zustand because it is small. It is small so it is easy. It is easy because there is little code, and little code means the team can read it. Also it is small, which is good for us. So yes, small and easy, that is why I chose it.",
    allowImprovedVersion: false,
    expect: { anyCode: ["repetitive", "too_long"] },
  },
  {
    id: "en-already-good-no-overcorrect",
    prompt: SLOW_LIST,
    transcript:
      "Our order list took eight seconds to load because we called five endpoints sequentially. I merged them into one backend request and added a thirty second cache, which brought the load time down to about one and a half seconds.",
    allowImprovedVersion: false,
    expect: { maxIssues: 2 },
  },
  {
    id: "en-with-previous-attempt-comparison",
    prompt: SLOW_LIST,
    transcript:
      "The list took eight seconds to load because of five sequential API calls. I merged them into one request, and it now loads in about one and a half seconds.",
    previousTranscript:
      "So basically, you know, the list was slow and I, like, fixed it by, you know, making it faster.",
    allowImprovedVersion: false,
    expect: {},
  },
  {
    id: "en-improved-version-allowed",
    prompt: SLOW_LIST,
    transcript:
      "The API are returning slow response because it have many joins. I optimize the query and the screen load faster now, so the customer is feeling happy.",
    previousTranscript:
      "The API is slow so I fix it and the customer is happy.",
    allowImprovedVersion: true,
    expect: { anyCode: ["grammar"] },
  },
];
