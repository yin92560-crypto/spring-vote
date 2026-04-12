export type Work = {
  id: string;
  title: string;
  imageUrl: string;
  votes: number;
  createdAt: string;
  /** 展示编号，如 001（按创建时间升序，API 计算） */
  displayNo: string;
};
