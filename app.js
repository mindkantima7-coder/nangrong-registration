const $ = (s) => document.querySelector(s);
const readyConfig = () => window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
  !window.SUPABASE_URL.includes("ใส่_") && !window.SUPABASE_ANON_KEY.includes("ใส่_");
let db = null;
if (readyConfig() && window.supabase) db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const setMsg = (el, text, type="") => { if(el){el.textContent=text;el.className=`message ${type}`;} };
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateText = (v) => v ? new Date(v).toLocaleDateString("th-TH") : "-";
function requireConfig() {
  if (!db) { alert("ยังไม่ได้ตั้งค่า Supabase กรุณาเปิดไฟล์ config.js แล้วใส่ Project URL และ anon key"); return false; }
  return true;
}

const regForm = $("#registration-form");
if (regForm) regForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!requireConfig()) return;
  const btn = regForm.querySelector('button[type="submit"]'); btn.disabled=true; btn.textContent="กำลังบันทึก...";
  const d = Object.fromEntries(new FormData(regForm).entries());
  try {
    const { error } = await db.rpc("register_student", {
      p_student_code:d.student_code.trim(), p_full_name:d.full_name.trim(), p_citizen_id:d.citizen_id.trim(),
      p_dob:d.dob, p_phone:d.phone.trim(), p_address:d.address.trim(), p_department:d.department.trim(),
      p_major:d.major.trim(), p_level:d.level, p_academic_year:d.academic_year.trim()
    });
    if(error) throw error;
    setMsg($("#registration-message"),"ลงทะเบียนสำเร็จ ระบบบันทึกข้อมูลของท่านแล้ว","success"); regForm.reset();
  } catch(err) { setMsg($("#registration-message"),err.message || "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล","error"); }
  finally { btn.disabled=false; btn.textContent="ส่งข้อมูลลงทะเบียน"; }
});

const publicBody = $("#student-list");
if (publicBody) {
  async function loadPublic() {
    if (!requireConfig()) return;
    const {data,error}=await db.rpc("public_student_directory");
    if(error){publicBody.innerHTML='<tr><td colspan="6" class="empty">ไม่สามารถโหลดรายชื่อได้</td></tr>';setMsg($("#directory-message"),error.message,"error");return;}
    window.publicRows=data||[]; renderPublic();
  }
  function renderPublic() {
    const q=($("#student-search").value||"").toLowerCase();
    const rows=(window.publicRows||[]).filter(x=>[x.student_code,x.full_name,x.department,x.major].join(" ").toLowerCase().includes(q));
    $("#student-count").textContent=`พบ ${rows.length} รายชื่อ`;
    publicBody.innerHTML=rows.length?rows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.student_code)}</td><td>${esc(x.full_name)}</td><td>${esc(x.department)}</td><td>${esc(x.major)}</td><td>${dateText(x.created_at)}</td></tr>`).join(""):'<tr><td colspan="6" class="empty">ไม่พบรายชื่อ</td></tr>';
  }
  $("#student-search").addEventListener("input",renderPublic); loadPublic();
}

const loginForm=$("#login-form");
if(loginForm) loginForm.addEventListener("submit",async e=>{
  e.preventDefault(); if(!requireConfig())return;
  const d=Object.fromEntries(new FormData(loginForm).entries()); const btn=loginForm.querySelector("button");btn.disabled=true;
  const {error}=await db.auth.signInWithPassword({email:d.email,password:d.password});
  if(error){setMsg($("#login-message"),"เข้าสู่ระบบไม่สำเร็จ: "+error.message,"error");btn.disabled=false;return;}
  const {data:roleData,error:roleError}=await db.from("user_roles").select("role").eq("user_id",(await db.auth.getUser()).data.user.id).maybeSingle();
  if(roleError||!roleData||roleData.role!=="admin"){await db.auth.signOut();setMsg($("#login-message"),"บัญชีนี้ยังไม่ได้รับสิทธิ์ Admin กรุณาติดต่อผู้ดูแลระบบ","error");btn.disabled=false;return;}
  location.href="admin.html";
});

const adminBody=$("#admin-list");
if(adminBody){
  let rows=[];
  async function initAdmin(){
    if(!requireConfig())return;
    const {data:{user}}=await db.auth.getUser();
    if(!user){location.href="admin-login.html";return;}
    const {data:role}=await db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
    if(!role||role.role!=="admin"){await db.auth.signOut();location.href="admin-login.html";return;}
    $("#admin-email").textContent=`เข้าสู่ระบบ: ${user.email}`;
    await loadAdmin();
  }
  async function loadAdmin(){
    const {data,error}=await db.from("registrations").select("*").order("created_at",{ascending:false});
    if(error){setMsg($("#admin-message"),error.message,"error");return;}
    rows=data||[];$("#total-count").textContent=rows.length;
    $("#voc-count").textContent=rows.filter(x=>x.level==="ปวช.").length;
    $("#high-count").textContent=rows.filter(x=>x.level==="ปวส.").length;renderAdmin();
  }
  function renderAdmin(){
    const q=($("#admin-search").value||"").toLowerCase();
    const filtered=rows.filter(x=>[x.student_code,x.full_name,x.phone,x.department,x.major].join(" ").toLowerCase().includes(q));
    adminBody.innerHTML=filtered.length?filtered.map(x=>`<tr><td>${esc(x.student_code)}</td><td>${esc(x.full_name)}</td><td>${esc(x.phone)}</td><td>${esc(x.level)}</td><td>${esc(x.department)} / ${esc(x.major)}</td><td class="actions"><button class="btn small light" data-edit="${x.id}">แก้ไข</button><button class="btn small danger" data-delete="${x.id}">ลบ</button></td></tr>`).join(""):'<tr><td colspan="6" class="empty">ไม่พบข้อมูล</td></tr>';
  }
  $("#admin-search").addEventListener("input",renderAdmin);
  adminBody.addEventListener("click",async e=>{
    const edit=e.target.closest("[data-edit]"); const del=e.target.closest("[data-delete]");
    if(edit){const x=rows.find(r=>r.id===edit.dataset.edit);const f=$("#admin-form");for(const [k,v] of Object.entries(x))if(f.elements[k])f.elements[k].value=v??"";$("#edit-title").textContent="แก้ไขข้อมูลนักเรียน";$("#edit-panel").scrollIntoView({behavior:"smooth"});}
    if(del){const x=rows.find(r=>r.id===del.dataset.delete);if(!confirm(`ยืนยันลบข้อมูล ${x.full_name} ?`))return;const {error}=await db.from("registrations").delete().eq("id",x.id);if(error)setMsg($("#admin-message"),error.message,"error");else{setMsg($("#admin-message"),"ลบข้อมูลเรียบร้อย","success");await loadAdmin();}}
  });
  $("#admin-form").addEventListener("submit",async e=>{
    e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f).entries());const id=d.id;delete d.id;
    const payload={...d,student_code:d.student_code.trim(),full_name:d.full_name.trim(),citizen_id:d.citizen_id.trim()};
    const result=id?await db.from("registrations").update(payload).eq("id",id):await db.from("registrations").insert(payload);
    if(result.error){setMsg($("#form-message"),result.error.message,"error");return;}
    setMsg($("#form-message"),"บันทึกข้อมูลเรียบร้อย","success");f.reset();f.elements.id.value="";$("#edit-title").textContent="เพิ่มข้อมูลนักเรียน";await loadAdmin();
  });
  $("#cancel-edit").addEventListener("click",()=>{setTimeout(()=>{ $("#admin-form").elements.id.value="";$("#edit-title").textContent="เพิ่มข้อมูลนักเรียน";},0);});
  $("#logout-btn").addEventListener("click",async()=>{await db.auth.signOut();location.href="admin-login.html";});
  initAdmin();
}