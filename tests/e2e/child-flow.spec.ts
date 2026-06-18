import { test, expect } from "@playwright/test";

test.describe("Habiku E2E: Alur Pengerjaan Misi Anak", () => {
  
  test("Orang tua login -> masuk Child Mode -> anak menyelesaikan misi -> persetujuan ortu", async ({ page }) => {
    // 1. Kunjungi Halaman Utama
    await page.goto("/");
    
    // Pastikan terarah ke halaman login jika belum terautentikasi
    await expect(page).toHaveURL(/\/login/);

    // 2. Proses Login Orang Tua
    await page.fill('input[type="email"]', "parent@habiku.id");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Verifikasi berhasil diarahkan ke dashboard orang tua
    await expect(page).toHaveURL(/\/parent/);
    await expect(page.locator("text=Dasbor Keluarga")).toBeVisible();

    // 3. Masuk Ke Menu Profil Anak untuk Child Mode
    await page.click('a[href="/parent/profil-anak"]');
    await expect(page).toHaveURL(/\/parent\/profil-anak/);

    // Klik Kartu Profil Anak bernama "Adit"
    await page.click('text=Adit');

    // Munculkan dialog PIN Sheet. Input PIN Anak (misal: 1234)
    const pinInputs = page.locator('input[type="password"]');
    await expect(pinInputs).toHaveCount(4);
    await pinInputs.nth(0).fill("1");
    await pinInputs.nth(1).fill("2");
    await pinInputs.nth(2).fill("3");
    await pinInputs.nth(3).fill("4");

    // Verifikasi berhasil bertransisi masuk ke dalam Child Mode
    await expect(page).toHaveURL(/\/child\/home/);
    await expect(page.locator("text=Hai, Adit!")).toBeVisible();

    // 4. Masuk ke Halaman Daftar Misi Harian Anak
    await page.click('a[href="/child/missions"]');
    await expect(page).toHaveURL(/\/child\/missions/);
    await expect(page.locator("text=Misi Harian Kamu")).toBeVisible();

    // Klik Tombol "Kerjakan Misi" pada misi "Merapikan Tempat Tidur"
    await page.click('text=Merapikan Tempat Tidur >> text=Kerjakan Misi');
    await expect(page.locator("text=Kerjakan Misi")).toBeVisible();

    // 5. Form Penyelesaian Misi: Tulis Catatan & Upload Foto
    await page.fill('textarea[id="notes"]', "Aku sudah merapikan selimut dan menyusun bantal dengan rapi ya Ma!");
    
    // Pilih foto bukti pengerjaan (simulasi file uploader)
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.click('text=Ambil Foto atau Upload');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "beds_clean.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-image-binary-payload"),
    });

    // Kirim Misi (memicu kompresi canvas & upload bukti foto)
    await page.click('button:has-text("Kirim Bukti Misi")');

    // Verifikasi perayaan/selebrasi sukses terkirim
    await expect(page.locator("text=Misi Terkirim!")).toBeVisible();
    
    // Tunggu redirect otomatis kembali ke daftar misi
    await page.waitForURL(/\/child\/missions/, { timeout: 3000 });

    // 6. Kembali Ke Mode Orang Tua (Keluar Child Mode)
    await page.click('button:has-text("Keluar")');
    
    // Input PIN Parent untuk memverifikasi hak akses keluar dari Child Mode
    const parentPinInputs = page.locator('input[type="password"]');
    await parentPinInputs.nth(0).fill("4");
    await parentPinInputs.nth(1).fill("3");
    await parentPinInputs.nth(2).fill("2");
    await parentPinInputs.nth(3).fill("1");

    // Kembali ke beranda orang tua
    await expect(page).toHaveURL(/\/parent/);

    // 7. Buka Antrean Persetujuan (Queue) untuk meninjau misi anak
    await page.click('a[href="/parent/queue"]');
    await expect(page).toHaveURL(/\/parent\/queue/);
    
    // Verifikasi adanya kartu misi "Adit" di antrean
    await expect(page.locator("text=Adit")).toBeVisible();
    await expect(page.locator("text=Merapikan Tempat Tidur")).toBeVisible();

    // 8. Berikan Persetujuan (Approve) Misi Anak
    await page.click('button:has-text("Setujui")');

    // Verifikasi toast keberhasilan dan hilangnya item dari antrean
    await expect(page.locator("text=Misi disetujui! Poin energi disalurkan.")).toBeVisible();
    await expect(page.locator("text=Antrean Bersih!")).toBeVisible();
  });
});
