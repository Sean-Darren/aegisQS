import {DocumentsPage} from "@/features/documents";
export default async function Page({params}:{params:Promise<{projectId:string}>}){const {projectId}=await params;return <DocumentsPage projectId={projectId}/>;}
