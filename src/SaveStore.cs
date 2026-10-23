using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;

internal static class SaveStore {
    internal static string Hash(byte[] bytes) { using(var sha=SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant(); }
    internal static void NoLinks(string path) {
        string p=Path.GetFullPath(path);
        if(p.StartsWith(@"\\")) throw new IOException("로컬 디스크의 세이브 파일을 선택하세요.");
        while(!String.IsNullOrEmpty(p)) {
            if((File.Exists(p)||Directory.Exists(p)) && (File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0) throw new IOException("링크 경로는 지원하지 않습니다: "+p);
            p=Path.GetDirectoryName(p);
        }
    }
    internal static byte[] Read(string path) {
        NoLinks(path);
        using(var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)) {
            if(stream.Length==0||stream.Length>10485760) throw new IOException("10 MiB 이하의 세이브 파일을 선택하세요.");
            byte[] data=new byte[(int)stream.Length]; int offset=0,n;
            while(offset<data.Length && (n=stream.Read(data,offset,data.Length-offset))>0) offset+=n;
            if(offset!=data.Length) throw new IOException("파일을 끝까지 읽지 못했습니다.");
            return data;
        }
    }
    internal static void WriteNew(string path,byte[] data) {
        NoLinks(path);
        using(var stream=new FileStream(path,FileMode.CreateNew,FileAccess.ReadWrite,FileShare.None)) {
            stream.Write(data,0,data.Length);stream.Flush(true);stream.Position=0;
            using(var sha=SHA256.Create()) using(var expected=SHA256.Create()) if(!sha.ComputeHash(stream).SequenceEqual(expected.ComputeHash(data))) throw new IOException("저장 검증 실패");
        }
    }
    internal static string CopyWithBackup(string source,string destination,string expectedHash,byte[] data) {
        source=Path.GetFullPath(source);destination=Path.GetFullPath(destination);
        NoLinks(source);NoLinks(destination);
        if(String.Equals(source,destination,StringComparison.OrdinalIgnoreCase)||File.Exists(destination))throw new IOException("새 복사본 경로를 선택하세요. 기존 파일은 덮어쓰지 않습니다.");
        if(!destination.EndsWith(".es3",StringComparison.OrdinalIgnoreCase)||data.Length==0||data.Length>10485760)throw new IOException("복사본 형식·크기 오류");
        byte[] original=Read(source);if(Hash(original)!=expectedHash)throw new IOException("원본이 변경되었습니다. 다시 열어 주세요.");
        string backup=destination+".original-"+Guid.NewGuid().ToString("N")+".bak";
        WriteNew(backup,original);WriteNew(destination,data);return backup;
    }
    internal static string ReplaceWithBackup(string path, string expectedHash, byte[] data) {
        path=Path.GetFullPath(path);NoLinks(path);
        if(!path.EndsWith(".es3",StringComparison.OrdinalIgnoreCase)) throw new IOException(".es3 파일만 저장할 수 있습니다.");
        if(data.Length==0||data.Length>10485760) throw new IOException("저장 크기 오류");
        string suffix=DateTime.Now.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N");
        string backup=path+".backup-"+suffix+".bak";
        // No delete sharing: external writers, renames and replacements are denied for the
        // whole transaction. Backup is flushed before the first change to the selected file.
        using(var target=new FileStream(path,FileMode.Open,FileAccess.ReadWrite,FileShare.None)) {
            if(target.Length==0||target.Length>10485760)throw new IOException("세이브 크기가 바뀌었습니다. 다시 여세요.");
            byte[] before=new byte[(int)target.Length];int offset=0,n;
            while(offset<before.Length&&(n=target.Read(before,offset,before.Length-offset))>0)offset+=n;
            if(offset!=before.Length||Hash(before)!=expectedHash)throw new IOException("세이브가 외부에서 변경되었습니다. 다시 열어 주세요. 저장은 취소됐습니다.");
            WriteNew(backup,before);
            using(var protectedBackup=new FileStream(backup,FileMode.Open,FileAccess.Read,FileShare.Read)) {
                using(var sha=SHA256.Create()) {
                    string checkedHash=BitConverter.ToString(sha.ComputeHash(protectedBackup)).Replace("-", "").ToLowerInvariant();
                    if(checkedHash!=expectedHash)throw new IOException("백업 검증 실패. 원래 세이브는 변경하지 않았습니다.");
                }
                UpdateOrRestore(target,before,data,backup);
            }
            return backup;
        }
    }
    internal static void UpdateOrRestore(Stream target,byte[] before,byte[] data,string backup) {
        try { WriteAndVerify(target,data); }
        catch(Exception writeError) {
            try { WriteAndVerify(target,before); }
            catch(Exception restoreError) { throw new IOException("저장 및 자동 원상복구에 실패했습니다. 게임을 열지 말고 백업을 복원하세요: "+backup+" / "+restoreError.Message,writeError); }
            throw new IOException("저장에 실패하여 원래 내용으로 복구했습니다. 백업: "+backup+" / "+writeError.Message,writeError);
        }
    }
    internal static void WriteAndVerify(Stream target,byte[] data) {
        target.Position=0;target.Write(data,0,data.Length);target.SetLength(data.Length);
        var file=target as FileStream;if(file!=null)file.Flush(true);else target.Flush();
        target.Position=0;
        using(var sha=SHA256.Create()) using(var expected=SHA256.Create())
            if(!sha.ComputeHash(target).SequenceEqual(expected.ComputeHash(data)))throw new IOException("저장 검증 실패");
    }
}
