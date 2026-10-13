import {json} from "@/lib/api";
export async function POST(){return json({error:"الدخول التجريبي غير متاح؛ استخدم حساب الفريق الحقيقي"},403);}
