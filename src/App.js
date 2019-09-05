import React from 'react';
import { Document, Page, pdfjs } from "react-pdf";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './App.css';
import testPdf from './test.pdf';

//  Set pdf.js build
pdfjs.GlobalWorkerOptions.workerSrc = `pdf.worker.js`;
//pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;


let uploadInputRef;

function Pages({ numPages }) {
    let pagesArray = [];

    for (let i = 1; i <= numPages; i++) {
        pagesArray.push(
            <Page className="pdf-page"
                  pageNumber={i}
                  key={`page-${i}`}
                  renderAnnotationLayer={true}
                  renderInteractiveForms={true}
                  renderTextLayer={true}
                  customTextRenderer={({height,  width, transform, scale, page, str}) => {
                      /*
                      height: height of text
                      width: width of text
                      transform: contain coordinates of text
                      scale: will be used for coords. conversing
                       */
                      return (<mark>{str}</mark>);
                  }}
            />
        );
    }

    return pagesArray;
}

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            numPages: null,
            pageNumber: 1,
            pdf: testPdf,
            title: testPdf.name
        };
    }

    onDocumentLoadSuccess = (document) => {
        console.log(document);
        document.getPage(1).then((page) => {
            //console.log(page.objs.get("img_p0_1"));
            // window.page = page;
            // window.viewport = page.getViewport({scale});
            // viewport.convertToPdfPoint(x, y)
            // let canvas = $('canvas');
            // let ctx = canvas.getContext('2d');
            // ctx.strokeRect(x, y - height, width, height)
            /*page.getOperatorList().then((data) => {
                console.log('Data:');
                console.log(data);
            });*/
        });

        document.getMetadata().then(({ info, metadata, contentDispositionFilename, }) => {
            let title = info.Title || this.state.pdf.name;
            this.setState({
                title,
            })
        });
        let {numPages} = document;
        this.setState({ numPages });
    }

    uploadFile = (e) => {
        let file = e.target.files[0];
        let reader = new FileReader();

        reader.onload = this._onUploadEnd(file);

        if (!file) {
            this.setState({
                pdf: null
            });
            return;
        }
        reader.readAsArrayBuffer(file);
    }

    uploadPdf = () => {
        uploadInputRef.click();
    }

    _onUploadEnd = (pdf) => {
        this.setState({
            numPages: null,
            pageNumber: 1,
            pdf
        })
    }

    _setRef(node) {
        uploadInputRef = node;
    }

    render() {
        const { pageNumber, numPages, title } = this.state;

        return (
            <div className="App">
                <header className="App-header">
                    <button onClick={this.uploadPdf}>
                        Upload other pdf
                    </button>
                    <input type='file' onChange={this.uploadFile.bind(this)} ref={this._setRef} style={{'display': 'none'}}/>
                </header>
                <article className="app-main-body">
                    <div className="pdf-data">
                        <p><b>Title: </b>{title}</p>
                        <p><b>Number of pages: </b>{numPages}</p>
                    </div>
                    <div className="pdf-wrapper">
                        <Document file={this.state.pdf}
                                  onLoadSuccess={this.onDocumentLoadSuccess}
                                  options={{
                                      cMapUrl: `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
                                      cMapPacked: true,
                                  }}
                        >
                            {Pages({ pageNumber, numPages })}
                        </Document>
                    </div>
                </article>
            </div>
        );
    }
}

export default App;
