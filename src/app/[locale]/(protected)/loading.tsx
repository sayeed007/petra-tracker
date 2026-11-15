import { Skeleton } from "antd";

export default function Loading() {
  return <div className="panel" aria-busy="true"><Skeleton active paragraph={{ rows: 6 }} /></div>;
}
