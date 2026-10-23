using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Drawing;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Beast Saga Equipment Editor")]
[assembly: AssemblyProduct("Beast Saga Equipment Editor")]
[assembly: AssemblyVersion("0.9.0.0")]
[assembly: AssemblyFileVersion("0.9.0.0")]

internal static class Program {
    internal static string RuntimeFolder;
    internal static string TestRoot;
    internal static string TestSave;
    internal static bool TestRootOwned;
    internal static int ExitCode;
    internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024, RecursionLimit = 24 };
    internal static byte[] Resource(string name) {
        using (var input = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) {
            if (input == null) throw new IOException("내장 파일 누락: " + name);
            using (var output = new MemoryStream()) { input.CopyTo(output); return output.ToArray(); }
        }
    }
    internal static string Hash(byte[] bytes) { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant(); }
    internal static void NoLinks(string path) {
        string p = Path.GetFullPath(path);
        while (!String.IsNullOrEmpty(p)) {
            if ((File.Exists(p) || Directory.Exists(p)) && (File.GetAttributes(p) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("링크 경로에는 저장하지 않습니다: " + p);
            p = Path.GetDirectoryName(p);
        }
    }
    internal static void WriteNew(string path, byte[] bytes) {
        NoLinks(path);
        using (var stream = new FileStream(path, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None)) {
            stream.Write(bytes, 0, bytes.Length); stream.Flush(true); stream.Position = 0;
            using (var sha = SHA256.Create()) using (var expected = SHA256.Create()) {
                if (!sha.ComputeHash(stream).SequenceEqual(expected.ComputeHash(bytes))) throw new IOException("저장 검증 실패");
            }
        }
    }
    static Assembly Resolve(object sender, ResolveEventArgs e) {
        string name = new AssemblyName(e.Name).Name;
        if (name == "Microsoft.Web.WebView2.Core" || name == "Microsoft.Web.WebView2.WinForms")
            return Assembly.Load(Resource(name + ".dll"));
        return null;
    }
    [STAThread] static void Main(string[] args) {
        try {
            AppDomain.CurrentDomain.AssemblyResolve += Resolve;
            if (args.Length == 3 && args[0] == "--self-test") {
                TestRoot = Path.GetFullPath(args[1]); TestSave = Path.GetFullPath(args[2]);
                if (Directory.Exists(TestRoot)) throw new IOException("검증 폴더는 새 경로여야 합니다.");
                NoLinks(Path.GetDirectoryName(TestRoot)); Directory.CreateDirectory(TestRoot); TestRootOwned = true;
                RuntimeFolder = TestRoot;
            } else if (args.Length != 0) throw new ArgumentException("지원하지 않는 실행 인수입니다.");
            else {
                // A separate application-owned cache, never an existing browser profile.
                string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BeastSagaEquipmentEditor");
                NoLinks(root); Directory.CreateDirectory(root);
                RuntimeFolder = Path.Combine(root, "runtime-0.9.0"); NoLinks(RuntimeFolder);
                Directory.CreateDirectory(RuntimeFolder);
            }
            string loader = Path.Combine(RuntimeFolder, "WebView2Loader.dll");
            byte[] native = Resource("WebView2Loader.dll");
            NoLinks(loader);
            if (File.Exists(loader)) {
                if (Hash(File.ReadAllBytes(loader)) != Hash(native)) throw new IOException("기존 WebView2 로더가 내장 파일과 다릅니다. 캐시를 확인하세요.");
            } else WriteNew(loader, native);
            Run();
        } catch (Exception ex) {
            ExitCode = 1;
            if (TestRoot != null) {
                if (TestRootOwned) WriteNew(Path.Combine(TestRoot, "failure.txt"), Encoding.UTF8.GetBytes(ex.ToString()));
            } else MessageBox.Show("편집기를 시작하지 못했습니다.\n" + ex.Message, "영수강호 편집기", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        Environment.ExitCode = ExitCode;
    }
    [MethodImpl(MethodImplOptions.NoInlining)] static void Run() {
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        CoreWebView2Environment.SetLoaderDllFolderPath(RuntimeFolder);
        Application.Run(new EditorForm());
    }
}

internal sealed class EditorForm : Form {
    readonly WebView2 web=new WebView2();
    bool working,closingAllowed,firstNavigation=true,selfTestStarted;
    string activePath,activeHash,session,lastBackup;
    public EditorForm(){
        Text="영수강호 · 세이브 편집기 0.9 · 자동 백업 저장";
        ClientSize=new Size(1280,900);MinimumSize=new Size(900,650);StartPosition=FormStartPosition.CenterScreen;
        web.Dock=DockStyle.Fill;Controls.Add(web);
        if(Program.TestRoot!=null){ShowInTaskbar=false;WindowState=FormWindowState.Minimized;}
        Shown+=async(s,e)=>await Initialize();
        FormClosing+=async(s,e)=>{
            if(closingAllowed||web.CoreWebView2==null)return;
            e.Cancel=true;if(working)return;
            try{
                string pending=await web.CoreWebView2.ExecuteScriptAsync("typeof counts!=='undefined' && hasEdits()");
                if(pending=="true"&&MessageBox.Show(this,"저장하지 않은 변경이 있습니다. 종료할까요?","종료",MessageBoxButtons.YesNo)!=DialogResult.Yes)return;
                closingAllowed=true;Close();
            }catch{closingAllowed=true;Close();}
        };
        FormClosed+=(s,e)=>web.Dispose();
    }
    async Task Initialize(){
        try{
            string profile=Path.Combine(Program.RuntimeFolder,"Profile");Program.NoLinks(profile);
            var env=await CoreWebView2Environment.CreateAsync(null,profile,new CoreWebView2EnvironmentOptions("--disable-background-networking"));
            await web.EnsureCoreWebView2Async(env);
            web.CoreWebView2.Settings.AreDevToolsEnabled=false;
            web.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;
            web.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled=false;
            web.CoreWebView2.Settings.IsPasswordAutosaveEnabled=false;
            web.CoreWebView2.Settings.IsGeneralAutofillEnabled=false;
            web.CoreWebView2.Settings.AreHostObjectsAllowed=false;
            web.CoreWebView2.NewWindowRequested+=(s,e)=>e.Handled=true;
            web.CoreWebView2.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;
            web.CoreWebView2.NavigationStarting+=(s,e)=>{bool allowed=firstNavigation&&e.Uri.StartsWith("data:text/html",StringComparison.OrdinalIgnoreCase);firstNavigation=false;if(!allowed)e.Cancel=true;};
            web.CoreWebView2.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
            web.CoreWebView2.WebResourceRequested+=(s,e)=>{if(e.Request.Uri.StartsWith("http:")||e.Request.Uri.StartsWith("https:"))e.Response=env.CreateWebResourceResponse(new MemoryStream(new byte[0]),403,"Offline","");};
            web.CoreWebView2.DownloadStarting+=(s,e)=>{e.Cancel=true;e.Handled=true;};
            web.CoreWebView2.WebMessageReceived+=Receive;
            web.CoreWebView2.NavigationCompleted+=(s,e)=>{
                if(!e.IsSuccess){Fail(new IOException("화면 로드 실패: "+e.WebErrorStatus));return;}
                if(Program.TestRoot!=null&&!selfTestStarted){selfTestStarted=true;BeginInvoke(new Action(async()=>await SelfTest()));}
            };
            web.CoreWebView2.NavigateToString(Encoding.UTF8.GetString(Program.Resource("editor.html")));
        }catch(Exception ex){Fail(ex);}
    }
    void Receive(object sender,CoreWebView2WebMessageReceivedEventArgs e){
        if(e.Source!="about:blank")return;
        // Leave the WebView2 event callback before any modal native dialog.
        string raw=e.WebMessageAsJson;
        if(raw.Length>14500000)return;
        BeginInvoke(new Action(()=>HandleRequest(raw)));
    }
    void Reply(string id,Dictionary<string,object> result){result["id"]=id;web.CoreWebView2.PostWebMessageAsJson(Program.Json.Serialize(result));}
    static string Get(Dictionary<string,object> d,string key){object v;if(!d.TryGetValue(key,out v)||!(v is string))throw new IOException("잘못된 요청: "+key);return (string)v;}
    void HandleRequest(string raw){
        string id="";bool acquired=false;
        try{
            var p=Program.Json.Deserialize<Dictionary<string,object>>(raw);id=Get(p,"id");string kind=Get(p,"kind");
            if(id.Length>32)throw new IOException("요청 ID 오류");
            if(working)throw new IOException("다른 파일 작업이 진행 중입니다.");
            working=true;acquired=true;
            if(kind=="open"&&p.Count==2){
                string path;
                if(Program.TestRoot!=null)path=Path.Combine(Program.TestRoot,"slot.es3");
                else using(var dialog=new OpenFileDialog()){
                    dialog.Title="게임을 종료한 뒤 실제 세이브 슬롯을 선택하세요";dialog.Filter="영수강호 세이브 (*.es3)|*.es3";dialog.CheckFileExists=true;dialog.Multiselect=false;
                    if(activePath!=null)dialog.InitialDirectory=Path.GetDirectoryName(activePath);
                    if(dialog.ShowDialog(this)!=DialogResult.OK){Reply(id,new Dictionary<string,object>{{"ok",true},{"cancelled",true}});return;}
                    path=Path.GetFullPath(dialog.FileName);
                }
                if(!path.EndsWith(".es3",StringComparison.OrdinalIgnoreCase))throw new IOException(".es3 파일을 선택하세요.");
                byte[] bytes=SaveStore.Read(path);
                // Parse confirmation happens in the page; a failed parse cannot stage a save.
                activePath=path;activeHash=SaveStore.Hash(bytes);session=Guid.NewGuid().ToString("N");
                Reply(id,new Dictionary<string,object>{{"ok",true},{"data",Convert.ToBase64String(bytes)},{"path",path},{"name",Path.GetFileName(path)},{"session",session}});
            }else if(kind=="save"&&p.Count==4){
                if(activePath==null||Get(p,"session")!=session)throw new IOException("열었던 세이브가 바뀌었습니다. 다시 여세요.");
                if(Program.TestRoot==null&&System.Diagnostics.Process.GetProcessesByName("BeastSaga").Length>0)throw new IOException("게임이 실행 중입니다. 게임을 종료한 뒤 저장하세요.");
                byte[] data=Convert.FromBase64String(Get(p,"data"));
                lastBackup=SaveStore.ReplaceWithBackup(activePath,activeHash,data);
                activeHash=SaveStore.Hash(data);session=Guid.NewGuid().ToString("N");
                Reply(id,new Dictionary<string,object>{{"ok",true},{"path",activePath},{"backup",lastBackup},{"session",session}});
            }else throw new IOException("지원하지 않는 요청입니다.");
        }catch(Exception ex){Reply(id,new Dictionary<string,object>{{"ok",false},{"error",ex.Message}});}
        finally{if(acquired)working=false;}
    }
    void Fail(Exception ex){
        Program.ExitCode=1;
        if(Program.TestRoot!=null){if(Program.TestRootOwned&&!File.Exists(Path.Combine(Program.TestRoot,"failure.txt")))Program.WriteNew(Path.Combine(Program.TestRoot,"failure.txt"),Encoding.UTF8.GetBytes(ex.ToString()));}
        else MessageBox.Show(this,ex.Message,"편집기 오류",MessageBoxButtons.OK,MessageBoxIcon.Error);
        closingAllowed=true;Close();
    }
    async Task Until(string expression){for(int i=0;i<160;i++){if(await web.CoreWebView2.ExecuteScriptAsync(expression)=="true")return;await Task.Delay(100);}throw new IOException("검증 응답 없음: "+expression);}
    async Task SelfTest(){
        try{
            string slot=Path.Combine(Program.TestRoot,"slot.es3");byte[] original=SaveStore.Read(Program.TestSave);SaveStore.WriteNew(slot,original);
            await web.CoreWebView2.ExecuteScriptAsync("document.getElementById('nativeOpen').click()");
            await Until("model!==null && !busy");
            await web.CoreWebView2.ExecuteScriptAsync(@"
              window.inputTest=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('input',{bubbles:true}));};
              $('moneyButton').click();if(!Equipment.isMoney(selected))throw Error('돈 경로 오류');inputTest('quantity','999998');if($('export').disabled)throw Error('정상 금액 저장 비활성');inputTest('quantity','');if(!$('export').disabled||!invalidDrafts.has('entry:'+selected.path))throw Error('잘못된 금액 허용');inputTest('quantity','1000000');$('pointsTab').click();$('moneyButton').click();if($('quantity').value!=='1000000')throw Error('돈 입력 손실');
              $('itemsTab').click();changeList('query','');changeList('sort','category-asc');changeList('category','2');changeList('subcategory','织锦');
              if(!listResult.entries.some(x=>x.name==='3妆花缎')||listResult.entries.some(x=>Categories.describe(x,'items').subId!=='织锦'))throw Error('카테고리 필터 오류');
              changeList('category','all');changeList('sort','name-asc');
              let seen=[];for(let n=1;n<=Math.ceil(model.items.length/50);n++){changeList('page',n);seen.push(...[...$('list').children].map(b=>b.dataset.path));}
              if(seen.length!==model.items.length||new Set(seen).size!==model.items.length)throw Error('페이지 항목 누락 또는 중복');
              changeList('sort','original');changeList('page',6);$('list').children[0].click();window.pagedPath=selected.path;window.pagedCount=String(Number(selected.count)+1);inputTest('quantity',pagedCount);changeList('category','2');changeList('category','all');
              changeList('page',1);changeList('page',6);$('list').children[0].click();if($('quantity').value!==pagedCount)throw Error('페이지 이동 중 입력 손실');
              $('pointsTab').click();inputTest('pointTalentAdd','123');inputTest('pointAddProSpot','1500');inputTest('pointLifePoints','999');inputTest('pointMedicineLevel','50');$('statsTab').click();
              inputTest('statPhysicalPower','500');inputTest('statLv','40');
              $('friendsTab').click();inputTest('friendPhysicalPower','500');inputTest('friendremainingPro','999');inputTest('friendremainingTalent','88');
              $('friendPicker').value='/saveFriendData/value/LeaveFriends/Ashou';$('friendPicker').dispatchEvent(new Event('change',{bubbles:true}));inputTest('friendPower','99');
              $('itemsTab').click();const cloth=model.items.find(x=>x.name==='3妆花缎');choose(cloth);inputTest('quantity','9999');
              const ring=model.gearByPath.get('/savePlayerData/value/PlayerDressEquip/6');tab='gears';choose(ring);
              $('effect0').value='抗毒增加';$('effect0').dispatchEvent(new Event('change',{bubbles:true}));$('export').click();
            ");
            await Until("!busy && pendingSize()===0 && $('status').textContent.startsWith('세이브 저장 완료')");
            await Until("doc.byPath.get('/savePlayerData/value/PhysicalPower').raw==='500' && doc.byPath.get('/savePlayerData/value/SixProCurrent/4').raw==='500' && Number(doc.byPath.get('/savePlayerData/value/_MaxHp').raw)>15000");
            await Until("doc.byPath.get('/saveFriendData/value/AddFriends/luxi/_PhysicalPower').raw==='500' && doc.byPath.get('/saveFriendData/value/LeaveFriends/Ashou/_Power').raw==='99' && friendPending.size===0");
            await web.CoreWebView2.ExecuteScriptAsync("$('pointsTab').click()");
            await Until("$('pointTalentAdd').value==='123' && $('pointLifePoints').value==='999' && $('pointMedicineLevel').value==='50'");
            await Until("Equipment.inspect(doc).itemByPath.get(pagedPath).count===pagedCount");
            await Until("Equipment.money(model).count==='1000000'");
            byte[] first=SaveStore.Read(slot);
            if(lastBackup==null||SaveStore.Hash(SaveStore.Read(lastBackup))!=SaveStore.Hash(original))throw new IOException("백업 불일치");
            await web.CoreWebView2.ExecuteScriptAsync(@"tab='items';choose(model.items.find(x=>x.name==='3妆花缎'));inputTest('quantity','10000');$('export').click();");
            await Until("!busy && counts.size===0 && $('status').textContent.startsWith('세이브 저장 완료')");
            if(SaveStore.Hash(SaveStore.Read(lastBackup))!=SaveStore.Hash(first))throw new IOException("두 번째 저장 백업 불일치");
            await web.CoreWebView2.ExecuteScriptAsync("$('nativeOpen').click()");
            await Until("!busy && model!==null");
            await web.CoreWebView2.ExecuteScriptAsync("$('pointsTab').click()");
            await Until("$('pointTalentAdd').value==='123' && $('pointLifePoints').value==='999' && $('pointMedicineLevel').value==='50' && Equipment.money(model).count==='1000000' && !hasEdits()");
            await web.CoreWebView2.ExecuteScriptAsync("$('moneyButton').click();inputTest('quantity','0');$('export').click()");
            await Until("!busy && !hasEdits() && Equipment.money(model).count==='0'");
            await web.CoreWebView2.ExecuteScriptAsync("$('nativeOpen').click()");
            await Until("!busy && model!==null && Equipment.money(model).count==='0'");
            var record=new Dictionary<string,object>{{"status","PASS"},{"moneyMaxAndZeroSavedReopened",true},{"moneyInvalidBlockedAndDraftPreserved",true},{"nativeOpenToUi",true},{"pointsSavedAndReopened",true},{"categoryFilterAndDraftPreserved",true},{"allPagesCoveredExactlyOnce",true},{"beyond200EditSaved",true},{"autoQueueWithoutStageButton",true},{"joinedAndDepartedCompanionEdit",true},{"uiStatsAutoHp",true},{"uiDropdownToSave",true},{"sameSlotReplaced",true},{"firstBackupExact",true},{"secondBackupExact",true},{"pendingClearedAfterAck",true},{"inputHash",SaveStore.Hash(original)},{"resultHash",SaveStore.Hash(SaveStore.Read(slot))},{"htmlHash",SaveStore.Hash(Program.Resource("editor.html"))}};
            Program.WriteNew(Path.Combine(Program.TestRoot,"receipt.json"),Encoding.UTF8.GetBytes(Program.Json.Serialize(record)));
            closingAllowed=true;Close();
        }catch(Exception ex){Fail(ex);}
    }
}
