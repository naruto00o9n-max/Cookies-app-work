export type PushStage =
  "configuration" | "permission" | "device" | "expo" | "server";
export class PushRegistrationError extends Error {
  constructor(
    readonly stage: PushStage,
    message: string,
  ) {
    super(message);
  }
}
export function pushError(stage: PushStage, platform: string, error: unknown) {
  if (error instanceof PushRegistrationError) return error;
  const detail = error instanceof Error ? error.message : "";
  const entitlement =
    /aps[- ]environment|no valid.*entitlement|missing.*push.*entitlement/i.test(
      detail,
    );
  const message =
    stage === "device" && platform === "ios" && entitlement
      ? "وافق الجهاز على الإشعارات، لكن نسخة التطبيق الموقعة لا تحتوي صلاحية APNs (aps-environment). يجب أن يطابق ملف التوقيع معرّف التطبيق team.cookies.tracker ويشمل صلاحية الإشعارات."
      : stage === "permission"
        ? "تعذر قراءة إذن الإشعارات. حاول مجددًا من إعدادات الجهاز."
        : stage === "device"
          ? "تعذر الحصول على عنوان إشعارات الجهاز من النظام. تحقق من اتصال الإنترنت، ثم حاول مجددًا. هذا الخطأ وحده لا يثبت وجود مشكلة في التوقيع."
          : stage === "expo"
            ? "إذن الجهاز متاح، لكن تعذر تسجيله لدى خدمة Expo. تحقق من الإنترنت ثم أعد المحاولة."
            : stage === "server"
              ? "تعذر حفظ ربط الجهاز بخدمة الفريق. تحقق من الاتصال وأعد المحاولة."
              : "إعداد الإشعارات غير مكتمل في هذه النسخة.";
  return new PushRegistrationError(stage, message);
}
export async function pushStep<T>(
  stage: PushStage,
  platform: string,
  task: () => Promise<T>,
  timeout = 20000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeout);
      }),
    ]);
  } catch (error) {
    throw pushError(stage, platform, error);
  } finally {
    clearTimeout(timer);
  }
}
export function singleFlight<T>(task: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending)
      pending = Promise.resolve()
        .then(task)
        .finally(() => {
          pending = undefined;
        });
    return pending;
  };
}
