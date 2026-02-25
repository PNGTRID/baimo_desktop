// Simple PNG to ICO converter
use image::{ImageReader, DynamicImage};
use std::fs::File;
use std::io::BufWriter;

fn main() {
    // Load PNG
    let img = ImageReader::open("icons/256x256.png")
        .unwrap()
        .decode()
        .unwrap();

    // Save as ICO
    let mut file = BufWriter::new(File::create("icons/icon.ico").unwrap());
    img.write_to(&mut file, image::ImageFormat::Ico).unwrap();

    println!("ICO file generated successfully");
}
