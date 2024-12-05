import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  SafeAreaView,
  ScrollView,
  Clipboard,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import TextRecognition from 'react-native-text-recognition';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';

const ImageOCRPDFExporter = () => {
  const [selectedImages, setSelectedImages] = useState([]);
  const [extractedTexts, setExtractedTexts] = useState([]);
  const [loading, setLoading] = useState(false);

  const requestStoragePermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const readGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Cấp quyền truy cập",
            message: "Ứng dụng cần quyền truy cập để đọc file",
            buttonNeutral: "Hỏi lại sau",
            buttonNegative: "Từ chối",
            buttonPositive: "Đồng ý"
          }
        );
        
        const writeGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: "Cấp quyền ghi file",
            message: "Ứng dụng cần quyền ghi file để lưu PDF",
            buttonNeutral: "Hỏi lại sau",
            buttonNegative: "Từ chối",
            buttonPositive: "Đồng ý"
          }
        );
        
        return readGranted === PermissionsAndroid.RESULTS.GRANTED && 
               writeGranted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch (err) {
      console.error('Error requesting permission:', err);
      return false;
    }
  };

  const processImage = async (imagePath) => {
    try {
      const results = await TextRecognition.recognize(imagePath, {
        visionIgnoreThreshold: 0.5,
      });
      
      return Array.isArray(results) ? results.join('\n') : 
             typeof results === 'string' ? results : '';
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Không thể xử lý ảnh');
    }
  };

  const pickImages = async () => {
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Thông báo', 'Bạn cần cấp quyền để sử dụng tính năng này');
        return;
      }

      setLoading(true);
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        includeBase64: true, // Needed for PDF export
        selectionLimit: 0,
      });

      if (result.assets) {
        setSelectedImages(result.assets);
        const texts = await Promise.all(
          result.assets.map(asset => processImage(asset.uri))
        );
        setExtractedTexts(texts);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi xử lý ảnh');
    } finally {
      setLoading(false);
    }
  };

  const generateHTMLContent = () => {
    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; }
            .page { 
              page-break-after: always;
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .page:last-child { page-break-after: auto; }
            img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
    `;

    selectedImages.forEach((image) => {
      htmlContent += `
        <div class="page">
          <img src="data:${image.type};base64,${image.base64}" />
        </div>
      `;
    });

    htmlContent += `
        </body>
      </html>
    `;

    return htmlContent;
  };

  const exportToPDF = async () => {
    try {
      if (!selectedImages.length) {
        Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một ảnh');
        return;
      }

      setLoading(true);

      const htmlContent = generateHTMLContent();
      
      const options = {
        html: htmlContent,
        fileName: `images_${Date.now()}`,
        directory: Platform.OS === 'ios' ? 'Documents' : 'Download',
        height: 842, // A4 height
        width: 595,  // A4 width
        padding: 0,
      };

      const pdf = await RNHTMLtoPDF.convert(options);
      
      if (pdf.filePath) {
        Alert.alert(
          'Thành công', 
          `File PDF đã được lưu tại:\n${pdf.filePath}`
        );

        await Clipboard.setString(pdf.filePath);
      }

    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Lỗi', 'Không thể tạo file PDF');
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setSelectedImages([]);
    setExtractedTexts([]);
  };

  return (
    <SafeAreaView style={{flex: 1}}>
      <View style={styles.container}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.imageButton]}
            onPress={pickImages}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Chọn ảnh</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.exportButton]}
            onPress={exportToPDF}
            disabled={loading || !selectedImages.length}
          >
            <Text style={styles.buttonText}>Xuất PDF</Text>
          </TouchableOpacity>
        </View>

        {extractedTexts.length > 0 && (
          <ScrollView style={styles.resultContainer}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Kết quả OCR:</Text>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearResults}
              >
                <Text style={styles.clearButtonText}>Xóa</Text>
              </TouchableOpacity>
            </View>
            {extractedTexts.map((text, index) => (
              <View key={index} style={styles.pageContainer}>
                <Text style={styles.pageTitle}>Trang {index + 1}</Text>
                <Text style={styles.resultText}>{text}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  imageButton: {
    backgroundColor: '#007AFF',
  },
  exportButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
    marginTop: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pageContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 16,
    lineHeight: 24,
  },
  clearButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ImageOCRPDFExporter;