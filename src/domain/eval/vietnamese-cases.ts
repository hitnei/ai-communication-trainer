import type { VietnameseCase } from "./checks";

const SLOW_LIST = "Hãy kể về một lần bạn xử lý vấn đề hiệu năng ở màn hình danh sách.";
const STATE_Q = "Vì sao bạn chọn thư viện quản lý state cho dự án gần nhất?";

export const vietnameseCases: VietnameseCase[] = [
  {
    id: "vi-main-point-late",
    prompt: SLOW_LIST,
    answer:
      "Hồi đó team em mới làm xong đợt release lớn, mọi người đang khá mệt, rồi khách hàng thì liên tục gửi feedback, em thì vừa chuyển sang module mới. Trong lúc đó thì có một màn hình danh sách đơn hàng chạy rất chậm. Vấn đề là mỗi lần mở màn hình đó phải chờ gần 8 giây vì mình gọi API tuần tự.",
    attemptNumber: 1,
    expect: { anyCode: ["main_point_late", "too_long"] },
  },
  {
    id: "vi-repetitive",
    prompt: STATE_Q,
    answer:
      "Em chọn Zustand vì nó nhẹ. Nó nhẹ nên dùng rất tiện. Dùng tiện vì code ít, code ít nên team dễ đọc. Với lại nó nhẹ nữa, nên em thấy hợp với dự án. Tóm lại là nó nhẹ và dùng tiện nên em chọn.",
    attemptNumber: 1,
    expect: { anyCode: ["repetitive", "too_long", "weak_logic"] },
  },
  {
    id: "vi-vague-idea",
    prompt: SLOW_LIST,
    answer:
      "Thì em thấy cái màn hình đó có vấn đề, kiểu như nó không được ổn lắm, nên em xem xét lại một số thứ và cải thiện nó. Sau đó thì nó tốt hơn.",
    attemptNumber: 1,
    expect: { anyCode: ["unclear_idea", "missing_point", "unclear", "incomplete"] },
  },
  {
    id: "vi-weak-logic",
    prompt: STATE_Q,
    answer:
      "Em chọn Redux vì nhiều người dùng nó, mà nhiều người dùng thì chắc chắn là nhanh. Nên dự án của em dùng Redux là hợp lý nhất.",
    attemptNumber: 1,
    expect: { anyCode: ["weak_logic", "missing_point"] },
  },
  {
    id: "vi-incomplete-no-solution",
    prompt: SLOW_LIST,
    answer:
      "Màn hình danh sách đơn hàng bị chậm, mở lên mất gần 8 giây, khách hàng phàn nàn rất nhiều. Em đã thấy là nó gọi API khá nhiều lần.",
    attemptNumber: 1,
    expect: { anyCode: ["incomplete", "missing_point"] },
  },
  {
    id: "vi-poor-structure",
    prompt: "Giải thích cho team vì sao nên chuyển sang TypeScript.",
    answer:
      "Cuối cùng thì team sẽ ít bug hơn. Em nghĩ mình nên chuyển. Trước đó thì có một lần production bị lỗi do truyền sai kiểu. Còn việc migrate thì có thể làm dần từng module. À mà TypeScript còn giúp autocomplete tốt nữa.",
    attemptNumber: 1,
    expect: { anyCode: ["poor_structure", "unclear", "weak_logic"] },
  },
  {
    id: "vi-already-good-no-overcorrect",
    prompt: SLOW_LIST,
    answer:
      "Màn hình danh sách đơn hàng mở mất 8 giây vì mình gọi 5 API tuần tự. Em gộp chúng thành một request ở backend và thêm cache 30 giây, nên thời gian tải giảm còn khoảng 1,5 giây.",
    attemptNumber: 1,
    expect: { maxIssues: 2 },
  },
  {
    id: "vi-code-switching-not-penalized",
    prompt: STATE_Q,
    answer:
      "Em dùng React Query cho server state vì nó có sẵn caching và retry, còn UI state thì để local state là đủ. Nhờ vậy em không phải tự viết boilerplate cho loading và error.",
    attemptNumber: 1,
    expect: { maxIssues: 2 },
  },
  {
    id: "vi-very-short",
    prompt: SLOW_LIST,
    answer: "Dạ em không nhớ rõ lắm, chắc là em tối ưu nó.",
    attemptNumber: 1,
    expect: { anyCode: ["incomplete", "missing_point", "unclear_idea"] },
  },
  {
    id: "vi-attempt-2-guide",
    prompt: SLOW_LIST,
    answer:
      "Màn hình danh sách đơn hàng bị chậm vì gọi API tuần tự. Em gộp lại thành một request. Sau đó nhanh hơn nhiều, khách hàng hài lòng.",
    previousAnswer:
      "Hồi đó team em mới làm xong đợt release lớn, rồi khách hàng gửi feedback liên tục. Có một màn hình danh sách đơn hàng chạy chậm vì gọi API tuần tự.",
    attemptNumber: 2,
    expect: {},
  },
  {
    id: "vi-attempt-3-improve",
    prompt: SLOW_LIST,
    answer:
      "Màn hình danh sách đơn hàng bị chậm vì gọi API tuần tự. Em gộp lại thành một request. Sau đó nhanh hơn nhiều, khách hàng hài lòng.",
    previousAnswer:
      "Màn hình danh sách đơn hàng chạy chậm, em đã tối ưu nó và nó nhanh hơn.",
    attemptNumber: 3,
    expect: {},
  },
  {
    id: "vi-attempt-4-improve-rambling",
    prompt: STATE_Q,
    answer:
      "Em chọn Zustand vì nó nhẹ. Nó nhẹ nên dùng rất tiện, code ít nên team dễ đọc. Với lại nó nhẹ nữa nên em thấy hợp với dự án. Tóm lại là em chọn vì nó nhẹ và tiện.",
    previousAnswer: "Em chọn Zustand vì nó nhẹ và tiện.",
    attemptNumber: 4,
    expect: {},
  },
];
