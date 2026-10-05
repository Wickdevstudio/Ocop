const SUPABASE_URL = "https://fovzpjflpkbgcsiaegvp.supabase.co";

const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdnpwamZscGtiZ2NzaWFlZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4Mzg3MzgsImV4cCI6MjEwNjQxNDczOH0.Mppz4N0S2pqHuvgE_UvFAHx96a7M7SUHXUWNfSimlNI";

const db = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
const fileSelect =
    document.getElementById("fileSelect");

const licenseInput =
    document.getElementById("license");

const runBtn =
    document.getElementById("runBtn");

const message =
    document.getElementById("message");

const connection =
    document.getElementById("connection");

const runnerStatus =
    document.getElementById("runnerStatus");

const lastFile =
    document.getElementById("lastFile");

const lastResult =
    document.getElementById("lastResult");


async function loadFiles() {

    const { data, error } = await db
        .from("files")
        .select("id,file_name")
        .eq("enabled", true)
        .order("file_name");

    if (error) {
        showMessage(
            "โหลดรายชื่อไฟล์ไม่สำเร็จ",
            "error"
        );

        return;
    }

    fileSelect.innerHTML =
        `<option value="">-- เลือกโปรแกรม --</option>`;

    for (const file of data) {

        const option =
            document.createElement("option");

        option.value = file.id;

        option.textContent =
            file.file_name;

        fileSelect.appendChild(option);
    }

    connection.textContent = "SUPABASE ONLINE";
    connection.className = "online";
}


async function checkLicense(key) {

    if (!key) {
        return false;
    }

    const { data, error } = await db
        .from("licences")
        .select("id,licence_key,enabled,expires_at")
        .eq("licence_key", key)
        .eq("enabled", true)
        .maybeSingle();

    if (error || !data) {
        return false;
    }

    if (data.expires_at) {

        const expiry =
            new Date(data.expires_at);

        if (expiry < new Date()) {
            return false;
        }
    }

    return true;
}


async function createRunRequest(
    fileId,
    fileName
) {

    const { data, error } = await db
        .from("run_requests")
        .insert({
            file_id: fileId,
            file_name: fileName,
            status: "waiting",
            requested_by: "web"
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}


runBtn.addEventListener(
    "click",
    async () => {

        runBtn.disabled = true;

        showMessage(
            "กำลังตรวจสอบ Licence...",
            "warning"
        );

        try {

            const fileId =
                fileSelect.value;

            const key =
                licenseInput.value.trim();

            if (!fileId) {
                throw new Error(
                    "กรุณาเลือกโปรแกรม"
                );
            }

            if (!key) {
                throw new Error(
                    "กรุณาใส่ Licence Key"
                );
            }

            const valid =
                await checkLicense(key);

            if (!valid) {
                throw new Error(
                    "Licence Key ไม่ถูกต้องหรือหมดอายุ"
                );
            }

            const selected =
                fileSelect.options[
                    fileSelect.selectedIndex
                ];

            const fileName =
                selected.textContent;

            const request =
                await createRunRequest(
                    fileId,
                    fileName
                );

            lastFile.textContent =
                fileName;

            lastResult.textContent =
                "WAITING";

            showMessage(
                `ส่งคำสั่งรัน ${fileName} แล้ว`,
                "success"
            );

            waitForResult(request.id);

        } catch (err) {

            console.error(err);

            showMessage(
                err.message,
                "error"
            );

        } finally {

            runBtn.disabled = false;
        }
    }
);


async function waitForResult(id) {

    let attempts = 0;

    const timer =
        setInterval(async () => {

            attempts++;

            const { data, error } =
                await db
                    .from("run_requests")
                    .select(
                        "status,result"
                    )
                    .eq("id", id)
                    .maybeSingle();

            if (error || !data) {
                return;
            }

            lastResult.textContent =
                data.status;

            if (
                data.status === "running" ||
                data.status === "finished" ||
                data.status === "error"
            ) {

                if (data.result) {
                    showMessage(
                        data.result,
                        data.status === "error"
                            ? "error"
                            : "success"
                    );
                }

                clearInterval(timer);
            }

            if (attempts >= 60) {
                clearInterval(timer);

                showMessage(
                    "Runner ไม่ตอบกลับภายในเวลาที่กำหนด",
                    "warning"
                );
            }

        }, 1000);
}


async function checkRunner() {

    const { data } =
        await db
            .from("run_requests")
            .select("id,status,file_name,result")
            .order("id", {
                ascending: false
            })
            .limit(1)
            .maybeSingle();

    if (!data) {

        runnerStatus.textContent =
            "UNKNOWN";

        return;
    }

    runnerStatus.textContent =
        data.status.toUpperCase();

    if (data.file_name) {
        lastFile.textContent =
            data.file_name;
    }

    if (data.result) {
        lastResult.textContent =
            data.result;
    }
}


function showMessage(
    text,
    type
) {

    message.textContent = text;

    message.className = type;
}


loadFiles();

checkRunner();

setInterval(
    checkRunner,
    5000
);