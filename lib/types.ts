export type Work = {
  id: string;
  title: string;
  /** 新增：作品名称（为空时回退 title） */
  workTitle: string;
  /** 新增：参赛人姓名 */
  authorName: string;
  imageUrl: string;
  votes: number;
  createdAt: string;
  /** 展示编号，如 001（按创建时间升序，API 计算） */
  displayNo: string;
};
