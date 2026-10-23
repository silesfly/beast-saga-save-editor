using System;
using System.IO;
using System.Linq;
class SaveStoreTests {
 static void Assert(bool b,string why){if(!b)throw new Exception(why);Console.WriteLine("PASS "+why);}
 static void Reject(Action a,string why){bool threw=false;try{a();}catch(IOException){threw=true;}catch(UnauthorizedAccessException){threw=true;}Assert(threw,why);}
 static int Main(string[] args){
  string root=Path.GetFullPath(args[0]);if(Directory.Exists(root))throw new Exception("New fixture only");Directory.CreateDirectory(root);
  string target=Path.Combine(root,"custom1.es3");byte[] a={1,2,3},b={7,8,9,10},c={11};
  SaveStore.WriteNew(target,a);string backup=SaveStore.ReplaceWithBackup(target,SaveStore.Hash(a),b);
  Assert(SaveStore.Read(target).SequenceEqual(b),"Locked overwrite uses original slot");Assert(SaveStore.Read(backup).SequenceEqual(a),"Backup preserves exact original bytes");
  string second=SaveStore.ReplaceWithBackup(target,SaveStore.Hash(b),c);
  Assert(second!=backup&&SaveStore.Read(second).SequenceEqual(b)&&SaveStore.Read(backup).SequenceEqual(a),"Repeated saves keep both backups");
  int before=Directory.GetFiles(root).Length;Reject(()=>SaveStore.ReplaceWithBackup(target,SaveStore.Hash(a),b),"External modification rejects stale write");
  Assert(SaveStore.Read(target).SequenceEqual(c)&&Directory.GetFiles(root).Length==before,"Stale-write rejection changes no file");
  using(var locked=new FileStream(target,FileMode.Open,FileAccess.ReadWrite,FileShare.None))Reject(()=>SaveStore.ReplaceWithBackup(target,SaveStore.Hash(c),b),"External file lock rejects save");
  Assert(SaveStore.Read(target).SequenceEqual(c),"Lock failure preserves selected slot");
  File.SetAttributes(target,FileAttributes.ReadOnly);
  Reject(()=>SaveStore.ReplaceWithBackup(target,SaveStore.Hash(c),b),"Read-only destination rejects save");File.SetAttributes(target,FileAttributes.Normal);
  Assert(SaveStore.Read(target).SequenceEqual(c),"Read-only failure preserves selected slot");
  Reject(()=>SaveStore.ReplaceWithBackup(target,SaveStore.Hash(c),new byte[0]),"Empty payload rejected");
  Reject(()=>SaveStore.ReplaceWithBackup(Path.Combine(root,"missing.es3"),SaveStore.Hash(c),b),"Missing target rejected");
  Assert(Directory.GetFiles(root,"*.pending-*").Length==0,"No pending temp files after tested failures");
  Reject(()=>SaveStore.WriteNew(backup,b),"Existing backup cannot be overwritten");
  using(var fail=new FaultStream(a,false)){Reject(()=>SaveStore.UpdateOrRestore(fail,a,b,"fixture.bak"),"Partial write failure reports failure");Assert(fail.ToArray().SequenceEqual(a),"Partial write failure restores exact original bytes");}
  using(var fail=new FaultStream(a,true)){try{SaveStore.UpdateOrRestore(fail,a,b,"fixture.bak");throw new Exception("Expected failure");}catch(IOException ex){Assert(ex.Message.Contains("fixture.bak")&&ex.Message.Contains("자동 원상복구에 실패"),"Persistent disk failure reports backup and failed rollback");}}
  string copy=Path.Combine(root,"copy.es3");string copyBackup=SaveStore.CopyWithBackup(target,copy,SaveStore.Hash(c),b);
  Assert(SaveStore.Read(target).SequenceEqual(c)&&SaveStore.Read(copy).SequenceEqual(b),"Copy save preserves source and writes separate destination");
  Assert(SaveStore.Read(copyBackup).SequenceEqual(c),"Copy backup equals source");
  Reject(()=>SaveStore.CopyWithBackup(target,target,SaveStore.Hash(c),b),"Copy save cannot select source");
  Reject(()=>SaveStore.CopyWithBackup(target,copy,SaveStore.Hash(c),a),"Copy cannot overwrite existing destination");
  string staleCopy=Path.Combine(root,"stale-copy.es3");Reject(()=>SaveStore.CopyWithBackup(target,staleCopy,SaveStore.Hash(a),b),"Stale source blocks copy");
  Assert(!File.Exists(staleCopy),"Stale copy failure creates no target");
  Console.WriteLine("ALL PASS");return 0;
 }
 class FaultStream:MemoryStream {
  bool fault=true;readonly bool persistent;
  public FaultStream(byte[] initial,bool always){base.Write(initial,0,initial.Length);Position=0;persistent=always;}
  public override void Write(byte[] b,int offset,int count){if(fault){if(!persistent)fault=false;base.Write(b,offset,Math.Min(1,count));throw new IOException("injected disk fault");}base.Write(b,offset,count);}
 }
}
