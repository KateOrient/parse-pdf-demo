import React from 'react';
import { Document, Page, pdfjs } from "react-pdf";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './App.css';
import testPdf from './test_2.pdf';
import _ from 'lodash';

//  Set pdf.js build
pdfjs.GlobalWorkerOptions.workerSrc = `pdf.worker.js`;
//pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;


let uploadInputRef;


function drawOnPageRenderSuccess(page) {
    page.getOperatorList().then((data) => {
        let positionData = data.argsArray[data.argsArray.length - 1];
        console.log('Data:', positionData);

        let canvas = document.getElementsByTagName('canvas')[page.pageIndex];
        let rect = canvas.getBoundingClientRect();

        let div = document.createElement('div');
        div.innerHTML = "";
        div.style.top = rect.y + 'px';
        div.style.left = rect.x + 'px';
        div.style.height = rect.height + 'px';
        div.style.width = rect.width + 'px';
        div.style.position = 'absolute';
        div.id = 'div' + page.pageIndex;
        div.className = 'bbox-container';
        document.getElementById('container').appendChild(div);

        div = document.getElementById('div' + page.pageIndex);
        _.map(positionData, (position, mcid) => {
            let child = document.createElement('div');
            child.style.top = parseInt(canvas.style.height, 10) - position.y - position.height  + 'px';
            child.style.left = position.x + 'px';
            child.style.height = position.height + 'px';
            child.style.width = position.width + 'px';
            child.style.position = 'absolute';
            child.className = 'bbox';
            child.id = mcid;
            div.appendChild(child);
        })
    });
}


function Pages({ numPages, onPageRenderSuccess }) {
    let pagesArray = [];

    for (let i = 1; i <= numPages; i++) {
        pagesArray.push(
            <Page className="pdf-page"
                  pageNumber={i}
                  key={`page-${i}`}
                  renderAnnotationLayer={true}
                  renderInteractiveForms={true}
                  renderTextLayer={true}
                  onRenderSuccess={drawOnPageRenderSuccess}
                  customTextRenderer={({height,  width, transform, scale, page, str}) => {
                      /*
                      height: height of text
                      width: width of text
                      transform: contain coordinates of text
                      scale: will be used for coords. conversing
                       */
                      return str;
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
            title: testPdf.name,
            boundingBoxes: null,
            renderedPages: 0,
            error: null
        };
    }

    componentDidUpdate() {
        if (this.state.renderedPages === this.state.numPages) {
            console.log('BBoxes', this.state.boundingBoxes);
            this.setState({renderedPages: 0});
        }
    }

    onDocumentLoadSuccess = (document) => {
        console.log(document);

        document.getMetadata().then(({ info, metadata, contentDispositionFilename, }) => {
            let title = info.Title || this.state.pdf.name;
            this.setState({
                title,
            })
        });
        let {numPages} = document;
        this.setState({ numPages });
    };

    onPageRenderSuccess = (page) => {
        page.getOperatorList().then(data => {
            let boundingBoxes = data.argsArray[data.argsArray.length - 1][0];
            this.setState({
                boundingBoxes:
                    this.state.boundingBoxes && this.state.renderedPages !== 0  ?
                        {...this.state.boundingBoxes, ...boundingBoxes} : boundingBoxes,
                renderedPages: this.state.renderedPages + 1
            })
        });
    };

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
        document.getElementById('container').innerHTML = "";

        this.setState({
            numPages: null,
            pageNumber: 1,
            pdf
        })
    }

    _setRef(node) {
        uploadInputRef = node;
    }

    onError = (e) => {
        this.setState({
           error: e.message
        });
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
                                  onLoadError={this.onError}
                                  error={<div className="error-msg">{this.state.error}</div> }
                        >
                            {Pages({ pageNumber, numPages, onPageRenderSuccess: this.onPageRenderSuccess })}
                        </Document>
                    </div>
                </article>
                <div id='container'/>
            </div>
        );
    }
}

export default App;
