{pkgs}: {
  deps = [
    pkgs.python312Packages.pip
    pkgs.python3
    pkgs.pkg-config
    pkgs.librsvg
    pkgs.giflib
    pkgs.libjpeg
    pkgs.pango
    pkgs.cairo
    pkgs.ffmpeg
  ];
}
